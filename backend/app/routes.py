"""All API routes. Session keys look like '2023_qatar_R_OCO'."""
import asyncio
import datetime as dt
import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile
from sse_starlette.sse import EventSourceResponse

from . import config, store
from .data import fastf1_client, openf1
from .engine.base import get_engine
from .pipeline import clipscore
from .engine.alerts import _red_mist

router = APIRouter(prefix="/api")

_progress: dict[str, dict] = {}  # session_key -> {done, total, status}


def _parse_key(key: str) -> tuple[int, str, str, str]:
    try:
        year, gp, session, driver = key.split("_")
        return int(year), gp, session, driver.upper()
    except ValueError:
        raise HTTPException(400, f"bad session key: {key}")


@router.get("/sessions")
def sessions():
    return store.get_sessions()


@router.get("/catalog/{year}")
def catalog_races(year: int):
    """Every real race in a season — powers the 'load any race' picker."""
    return openf1.list_races(year)


@router.get("/catalog/{year}/drivers")
def catalog_drivers(year: int, session_key: int):
    return openf1.list_drivers(session_key)


@router.post("/sessions/{key}/load")
def load_session(key: str, tasks: BackgroundTasks):
    if _progress.get(key, {}).get("status") == "running":
        return {"status": "already_running"}
    _progress[key] = {"done": 0, "total": 0, "status": "running"}
    tasks.add_task(_process_session, key)
    return {"status": "started", "progress_url": f"/api/sessions/{key}/progress"}


def _process_session(key: str) -> None:
    year, gp, session, driver = _parse_key(key)
    prog = _progress[key]
    try:
        session_map = {"R": "Race", "Q": "Qualifying", "S": "Sprint"}
        of1 = openf1.find_session(year, gp, session_map.get(session, session))
        if not of1 and not config.OFFLINE:
            raise RuntimeError("session not found on OpenF1")
        clips_meta, t0 = [], None
        if of1:
            num = openf1.driver_number(of1["session_key"], driver)
            clips_meta = openf1.team_radio(of1["session_key"], num) if num else []
            t0 = dt.datetime.fromisoformat(of1["date_start"])
        prog["total"] = len(clips_meta)

        laps = fastf1_client.get_lap_points(key, year, gp, session, driver)

        def lap_at(t_s: float):
            cur = None
            for l in laps:
                if l["t_start_s"] <= t_s:
                    cur = l["lap"]
            return cur

        scores = []
        for i, cm in enumerate(clips_meta):
            clip_id = f"{key}_{i:03d}"
            t_s = (dt.datetime.fromisoformat(cm["date"]) - t0).total_seconds()
            try:
                path = openf1.download_clip(cm["recording_url"], clip_id)
                s = clipscore.score_clip(path, clip_id, round(t_s, 1),
                                         lap=lap_at(t_s), audio_url=cm["recording_url"])
                scores.append(s)
            except Exception as e:
                print(f"[load] clip {clip_id} failed: {e}")
            prog["done"] = i + 1

        scores = clipscore.apply_baseline(scores, key)
        store.delete_clips(key)  # clean slate — a re-load must never leave stale rows behind
        for s in scores:
            store.save_clip(key, s)
        store.save_session(key, {"key": key, "year": year, "gp": gp, "session": session,
                                 "driver": driver, "clip_count": len(scores), "ready": True})
        prog["status"] = "done"
    except Exception as e:
        prog["status"] = f"error: {e}"


@router.get("/sessions/{key}/progress")
async def progress(key: str):
    async def gen():
        while True:
            p = _progress.get(key, {"status": "unknown"})
            yield {"data": json.dumps(p)}
            if p.get("status") != "running":
                break
            await asyncio.sleep(0.5)
    return EventSourceResponse(gen())


@router.get("/sessions/{key}/clips")
def clips(key: str):
    return store.get_clips(key)


@router.get("/sessions/{key}/trace")
def trace(key: str, engine: str = Query(default=None)):
    cl = store.get_clips(key)
    if not cl:
        raise HTTPException(404, "session not processed")
    laps = store.get_laps(key)
    eng = get_engine(engine or config.ENGINE)
    tr, alerts = eng.score_session(cl, laps)
    return {"engine": eng.name,
            "trace": [t.model_dump() for t in tr],
            "alerts": [a.model_dump() for a in alerts],
            "laps": laps}


async def _score_upload(file: UploadFile, baseline: int, baseline_key: str) -> dict:
    suffix = Path(file.filename or "clip.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=config.CACHE_DIR) as f:
        f.write(await file.read())
        tmp = Path(f.name)
    try:
        s = clipscore.score_clip(tmp, f"{baseline_key}_{tmp.stem}", 0.0)
    except Exception:
        # boundary validation: not every upload is a valid audio file — reject
        # cleanly instead of a raw 500 leaking ffmpeg's internals
        raise HTTPException(400, "couldn't read that as audio — try a wav/mp3/webm clip")
    finally:
        tmp.unlink(missing_ok=True)

    if baseline:
        store.save_baseline(baseline_key, {"a_mean": s["arousal"], "a_sd": 0.08,
                                           "v_mean": s["valence"], "v_sd": 0.08})
        s.update({"label": "calm", "confidence": 0.9, "baseline_captured": True})
        return s

    b = store.get_baseline(baseline_key)
    if b:
        s["arousal_z"] = round((s["arousal"] - b["a_mean"]) / b["a_sd"], 2)
        s["valence_z"] = round((s["valence"] - b["v_mean"]) / b["v_sd"], 2)
    s["label"], s["confidence"] = clipscore._label(s["arousal_z"], s["valence_z"], True)
    s["signals_agree"] = True
    alerts = _red_mist([s])
    s["alerts"] = [a.model_dump() for a in alerts]
    return s


@router.post("/mic/score")
async def mic_score(file: UploadFile, baseline: int = Query(default=0)):
    return await _score_upload(file, baseline, "mic")


@router.post("/upload")
async def upload(file: UploadFile):
    """Brief-required manual path; reuses the mic pipeline."""
    return await _score_upload(file, 0, "upload")


@router.get("/sessions/{key}/wrapped/{drv}")
def wrapped(key: str, drv: str):
    cl = store.get_clips(key)
    if not cl:
        raise HTTPException(404, "session not processed")
    labels = [c["label"] for c in cl]
    hot = max(cl, key=lambda c: c["arousal_z"])
    meta = next((m for m in store.get_sessions() if m["key"] == key), {})
    zs = [c["arousal_z"] for c in cl]

    # Composure: 100 * (1 - volatility), volatility = RMS(arousal_z)/3 clamped to
    # [0,1] — a driver who stays near their own baseline scores high regardless of
    # how "excitable" that baseline is (D2: relative, never absolute).
    rms = (sum(z * z for z in zs) / len(zs)) ** 0.5
    composure = round(100 * max(0.0, min(1.0, 1 - rms / 3)))

    # Composure Curve building block: recovery time. For each spike (z > 1.2),
    # count clips until z drops back under 0.5 — a maturing driver's recovery
    # window shrinks over the session. Real signal from real per-clip data.
    recoveries: list[int] = []
    i = 0
    while i < len(zs):
        if zs[i] > 1.2:
            j = i + 1
            while j < len(zs) and zs[j] >= 0.5:
                j += 1
            recoveries.append(j - i)
            i = j
        else:
            i += 1
    avg_recovery_clips = round(sum(recoveries) / len(recoveries), 1) if recoveries else 0.0

    step = max(1, len(cl) // 20)
    spark = [round(c["arousal_z"], 2) for c in cl[::step]][:20]

    return {
        "driver": drv, "session": meta,
        "clip_count": len(cl),
        "pct_calm": round(labels.count("calm") / len(cl) * 100),
        "pct_stressed": round(labels.count("stressed") / len(cl) * 100),
        "pct_tired": round(labels.count("tired") / len(cl) * 100),
        "spiciest_clip": {"transcript": hot["transcript"], "arousal_z": hot["arousal_z"],
                          "lap": hot["lap"], "audio_url": hot["audio_url"]},
        "avg_confidence": round(sum(c["confidence"] for c in cl) / len(cl), 2),
        "peak_stress_lap": hot["lap"],
        "composure": composure,
        "avg_recovery_clips": avg_recovery_clips,
        "spark": spark,
    }
