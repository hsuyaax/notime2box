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
    """Circumplex quadrants on the driver's OWN z-scores.

    Arousal alone cannot separate "furious" from "delighted" — both are high-arousal.
    Valence is what splits them, so high arousal only reads as STRESSED when valence
    is genuinely depressed. Verified against real radio: the highest-arousal clips in
    our sessions are "Nice job, Max" and "I am happy now" (a_z +1.2, v_z +1.9). A
    detector that painted those red would be wrong, and a pit wall would stop
    trusting it by lap 10.

    ELEVATED is the honest middle: clearly above this driver's normal, but not
    negative enough to call stress. Better than forcing a binary.
    """
    if a_z >= 1.0 and v_z <= -0.4:
        lab, conf = "stressed", 0.75
    elif a_z <= -1.0 and v_z <= 0.0:
        lab, conf = "tired", 0.70          # flat AND low mood, not merely quiet
    elif a_z >= 1.2:
        lab, conf = "elevated", 0.65       # animated, but not negative → not stress
    else:
        lab, conf = "calm", 0.70
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
    # Vote thresholds are RELATIVE to this session, matching the z-score philosophy.
    # Absolute constants were badly miscalibrated against real radio: the text gate
    # (anger+fear > 0.4) sat above the 95th percentile of real values, so that channel
    # could essentially never vote "hot" — which made 2-of-3 agreement structurally
    # unreachable and flagged 47% of clips as "signals disagree". Disagreement should
    # be a real finding, not an artefact of a threshold nobody checked.
    def ranks(values: list[float]) -> list[float]:
        """Percentile rank of each value within the session — puts three differently
        scaled channels (arousal, speech rate, text negativity) on one 0..1 axis."""
        order = sorted(range(len(values)), key=lambda i: values[i])
        out = [0.0] * len(values)
        for pos, i in enumerate(order):
            out[i] = pos / max(len(values) - 1, 1)
        return out

    r_arousal = ranks([c["arousal"] for c in clips])
    r_rate = ranks([c["prosody"]["rate_sps"] for c in clips])
    r_text = ranks([c["text_emotion"].get("anger", 0) + c["text_emotion"].get("fear", 0)
                    for c in clips])

    for i, c in enumerate(clips):
        c["arousal_z"] = round((c["arousal"] - stats["a_mean"]) / stats["a_sd"], 2)
        c["valence_z"] = round((c["valence"] - stats["v_mean"]) / stats["v_sd"], 2)

        # Agreement = do the three instruments point the same way? Measured as the
        # spread of their within-session ranks, which is continuous and scale-free.
        # A hard 2-of-3 vote on thresholds was worse than useless here: with ~25%
        # "hot" gates, "exactly one hot" happens ~42% of the time by construction,
        # so it manufactured disagreement rather than detecting it.
        rs = [r_arousal[i], r_rate[i], r_text[i]]
        c["signal_spread"] = round(max(rs) - min(rs), 2)
        c["signals_agree"] = c["signal_spread"] <= 0.5 or len(clips) < 4
        c["label"], c["confidence"] = _label(c["arousal_z"], c["valence_z"], c["signals_agree"])
    return clips
