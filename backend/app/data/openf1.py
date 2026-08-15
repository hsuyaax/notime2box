"""OpenF1 client — team radio MP3 URLs + session/driver meta. Unofficial API; cached."""
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


def find_session(year: int, gp: str, session_name: str = "Race") -> dict | None:
    sessions = _get("sessions", year=year, session_name=session_name)
    gp_l = gp.lower()
    for s in sessions:
        if gp_l in s.get("country_name", "").lower() or gp_l in s.get("circuit_short_name", "").lower():
            return s
    return None


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
