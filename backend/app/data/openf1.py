"""OpenF1 client — team radio MP3 URLs + session/driver meta. Unofficial API; cached."""
import datetime as dt
import re
from pathlib import Path

import requests

from .. import config, store

BASE = "https://api.openf1.org/v1"


def _get(endpoint: str, **params) -> list[dict]:
    key = endpoint + "_" + "_".join(f"{k}{v}" for k, v in sorted(params.items()))
    key = re.sub(r"[^\w]", "", key)
    cached = store.cache_get("openf1", key)
    if cached is not None:
        return cached
    if config.OFFLINE:
        return []
    r = requests.get(f"{BASE}/{endpoint}", params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    store.cache_put("openf1", key, data)
    return data


def _norm(s: str) -> str:
    """Alnum-only lowercase — makes multi-word race names ("Saudi Arabia") match a
    space-free gp slug ("saudiarabia") used in session keys (which split on '_')."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def gp_slug(s: dict) -> str:
    return _norm(s.get("circuit_short_name") or s.get("country_name") or "")


def find_session(year: int, gp: str, session_name: str = "Race") -> dict | None:
    sessions = _get("sessions", year=year, session_name=session_name)
    gp_n = _norm(gp)
    for s in sessions:
        if gp_n in _norm(s.get("country_name", "")) or gp_n in _norm(s.get("circuit_short_name", "")):
            return s
    return None


def list_races(year: int, session_name: str = "Race") -> list[dict]:
    """Every race in a season, with a ready-to-use gp_slug for building session keys."""
    sessions = _get("sessions", year=year, session_name=session_name)
    return [{"gp_slug": gp_slug(s), "country_name": s["country_name"],
             "circuit_short_name": s["circuit_short_name"], "session_key": s["session_key"],
             "date_start": s["date_start"]} for s in sessions]


def list_drivers(session_key: int) -> list[dict]:
    return [{"acronym": d.get("name_acronym"), "full_name": d.get("full_name"),
             "team_name": d.get("team_name"), "driver_number": d.get("driver_number")}
            for d in _get("drivers", session_key=session_key)]


def driver_number(session_key: int, acronym: str) -> int | None:
    for d in _get("drivers", session_key=session_key):
        if d.get("name_acronym", "").upper() == acronym.upper():
            return d["driver_number"]
    return None


def team_radio(session_key: int, driver_number: int) -> list[dict]:
    """[{date, recording_url, ...}] sorted by date."""
    clips = _get("team_radio", session_key=session_key, driver_number=driver_number)
    return sorted(clips, key=lambda c: c["date"])


def session_start(session_key: int) -> str | None:
    s = _get("sessions", session_key=session_key)
    return s[0]["date_start"] if s else None


def _from_filename(url: str, offset_s: float) -> "dt.datetime | None":
    m = re.search(r"_(\d{8})_(\d{6})\.mp3", url)
    if not m:
        return None
    local = dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
    return local.replace(tzinfo=dt.timezone.utc) - dt.timedelta(seconds=offset_s)


def clip_times(session: dict, clips: list[dict]) -> tuple[list[float], str]:
    """Seconds-since-session-start for each clip, plus which source we trusted.

    OpenF1's `date` field is not reliable across sessions: for Montreal 2024 all 16
    of a driver's clips carry timestamps inside a 21-second window just before lights
    out (clearly collapsed upstream), while for Qatar 2023 and Suzuka 2024 it is the
    *filenames* that don't line up. Neither source wins everywhere, so pick per
    session on evidence rather than trusting one blindly: score each candidate by how
    many clips land inside the session window and how well they spread, and take the
    best. Falls back to the raw `date` field when nothing looks coherent — a squashed
    timeline is better than a silently invented one.
    """
    t0 = dt.datetime.fromisoformat(session["date_start"])
    end = session.get("date_end")
    dur = (dt.datetime.fromisoformat(end) - t0).total_seconds() if end else 7200.0
    try:
        hh, mm, ss = (int(v) for v in str(session.get("gmt_offset", "0:0:0")).split(":"))
        offset_s = hh * 3600 + (mm * 60 + ss) * (1 if hh >= 0 else -1)
    except Exception:
        offset_s = 0.0

    def secs(times):
        return [(t - t0).total_seconds() if t else 0.0 for t in times]

    candidates = {
        "openf1_date": secs([dt.datetime.fromisoformat(c["date"]) for c in clips]),
        "filename_utc": secs([_from_filename(c["recording_url"], 0) for c in clips]),
        "filename_local": secs([_from_filename(c["recording_url"], offset_s) for c in clips]),
    }

    def score(ts: list[float]) -> float:
        if not ts or all(t == 0.0 for t in ts):
            return -1.0
        inside = sum(1 for t in ts if -1800 <= t <= dur + 1800) / len(ts)
        spread = (max(ts) - min(ts)) / max(dur, 1.0)          # 1.0 == spans the session
        return inside + min(spread, 1.0)

    best = max(candidates, key=lambda k: score(candidates[k]))
    if score(candidates[best]) < 0.5:
        best = "openf1_date"
    return candidates[best], best


def download_clip(url: str, clip_id: str) -> Path:
    out = config.AUDIO_DIR / f"{clip_id}.mp3"
    if out.exists():
        return out
    if config.OFFLINE:
        raise FileNotFoundError(f"OFFLINE=1 and {out} not in bundle")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    out.write_bytes(r.content)
    return out
