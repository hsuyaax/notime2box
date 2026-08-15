"""Per-clip orchestration → ClipScore, cached by audio hash. Then per-driver
baseline z-scoring across a session (D2: z vs the driver's own normal)."""
import statistics
from pathlib import Path

from .. import store
from ..contracts import ClipScore, Prosody
from . import audio, asr, emotion, prosody, text_emotion


# Bump whenever a model or its wiring changes, so cached scores from an older
# pipeline can never be served silently. v2: audeering loaded via its real custom
# regression head (v1 cached a random-head near-constant arousal — see
# pipeline/audeering_model.py).
PIPELINE_VERSION = "v2"


def score_clip(path: Path, clip_id: str, t_session_s: float, lap=None, audio_url="") -> dict:
    h = f"{PIPELINE_VERSION}_{store.file_hash(path)}"
    cached = store.cache_get("clipscore", h)
    if cached:
        cached.update({"clip_id": clip_id, "t_session_s": t_session_s,
                       "lap": lap, "audio_url": audio_url})
        return cached

    samples, dur = audio.prepare(path)
    pros = prosody.analyse(samples)
    tr = asr.transcribe(samples)
    dim = emotion.dimensional(samples, pros)
    cat = emotion.categorical(samples)
    txt = text_emotion.analyse(tr["transcript"])

    result = ClipScore(
        clip_id=clip_id, t_session_s=t_session_s, lap=lap, audio_url=audio_url,
        duration_s=round(dur, 2),
        transcript=tr["transcript"], asr_conf=tr["asr_conf"],
        asr_model=tr["asr_model"], word_confs=tr["word_confs"],
        arousal=dim["arousal"], valence=dim["valence"],
        cat_emotion=cat, prosody=Prosody(**pros), text_emotion=txt,
    ).model_dump()
    store.cache_put("clipscore", h, result)
    return result


def _label(a_z: float, v_z: float, agree: bool) -> tuple[str, float]:
    """Mapping (ours): high A + low V → stressed; low A → tired; else calm."""
    if a_z >= 1.2 and v_z <= -0.5:
        lab, conf = "stressed", 0.75
    elif a_z <= -1.2:
        lab, conf = "tired", 0.7
    elif abs(a_z) < 1.2:
        lab, conf = "calm", 0.7
    else:
        lab, conf = "stressed", 0.55
    if agree:
        conf = min(conf + 0.15, 0.95)
    else:
        conf = max(conf - 0.2, 0.3)
        if conf < 0.45:
            lab = "uncertain"      # disagreement renders honestly, never a forced label
    return lab, round(conf, 2)


def apply_baseline(clips: list[dict], baseline_key: str) -> list[dict]:
    """Compute per-driver mean/σ over the session, write z-scores + labels in place."""
    if not clips:
        return clips
    a = [c["arousal"] for c in clips]
    v = [c["valence"] for c in clips]
    stats = {"a_mean": statistics.mean(a), "a_sd": max(statistics.pstdev(a), 0.05),
             "v_mean": statistics.mean(v), "v_sd": max(statistics.pstdev(v), 0.05)}
    store.save_baseline(baseline_key, stats)
    for c in clips:
        c["arousal_z"] = round((c["arousal"] - stats["a_mean"]) / stats["a_sd"], 2)
        c["valence_z"] = round((c["valence"] - stats["v_mean"]) / stats["v_sd"], 2)
        # three weak votes: acoustic arousal, prosody rate, text negativity
        votes_hot = [c["arousal_z"] > 0.5,
                     c["prosody"]["rate_sps"] > 4.5,
                     c["text_emotion"].get("anger", 0) + c["text_emotion"].get("fear", 0) > 0.4]
        c["signals_agree"] = sum(votes_hot) >= 2 or sum(votes_hot) == 0
        c["label"], c["confidence"] = _label(c["arousal_z"], c["valence_z"], c["signals_agree"])
    return clips
