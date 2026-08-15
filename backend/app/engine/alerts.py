"""Alert rules — deliberately simple ON TOP of sophisticated inference (Part C4).

FATIGUE DRIFT: p_change>0.8 AND new-regime arousal_z <= -1.2 sustained >=3 clips
               AND rolling lap delta >= +0.25 s vs the driver's clean-air median.
RED MIST:      arousal_z >= +1.8 AND (angry OR text-anger >= 0.5) AND rate > baseline.
Evidence dicts attach verbatim; the UI renders the rows — explainability for free.
"""
import statistics
from .. import config
from ..contracts import Alert


def _lap_delta(laps: list[dict], lap_range: list[int]) -> float:
    times = [l["lap_time_s"] for l in laps if l.get("lap_time_s") and not l.get("is_pit")]
    if len(times) < 5:
        return 0.0
    median = statistics.median(times)
    window = [l["lap_time_s"] for l in laps
              if l.get("lap_time_s") and not l.get("is_pit") and l["lap"] in lap_range]
    if not window:
        return 0.0
    return statistics.mean(window) - median


def detect_alerts(clips: list[dict], trace, laps: list[dict]) -> list[Alert]:
    alerts: list[Alert] = []
    alerts += _fatigue_drift(clips, trace, laps)
    alerts += _red_mist(clips)
    return sorted(alerts, key=lambda a: a.t_start)


def _fatigue_drift(clips, trace, laps) -> list[Alert]:
    out = []
    run: list[int] = []       # indices of sustained low-arousal drift
    has_bocpd = any(t.p_change > 0 for t in trace)
    for i, (c, tp) in enumerate(zip(clips, trace)):
        drifting = c["arousal_z"] <= config.FATIGUE_AROUSAL_Z
        # changepoint often lands 1-2 clips before the drift deepens → small lookback;
        # naive engine has no BOCPD, so the gate only applies when p_change exists
        changed = (not has_bocpd) or any(
            t.p_change > config.FATIGUE_P_CHANGE for t in trace[max(0, i - 2):i + 1])
        if drifting and (run or changed):
            run.append(i)
        else:
            run = [i] if (drifting and changed) else []
        if len(run) >= config.FATIGUE_MIN_CLIPS:
            lap_range = [clips[j].get("lap") for j in run if clips[j].get("lap")]
            delta = _lap_delta(laps, list(range(min(lap_range), max(lap_range) + 1))) if lap_range else 0.0
            if delta >= config.FATIGUE_LAP_DELTA_S:
                zs = [clips[j]["arousal_z"] for j in run]
                out.append(Alert(
                    type="fatigue_drift",
                    t_start=clips[run[0]]["t_session_s"], t_end=c["t_session_s"],
                    laps=lap_range,
                    evidence={"arousal_z": round(min(zs), 2),
                              "sustained_clips": len(run),
                              "lap_delta_s": round(delta, 2)},
                    confidence=min(0.95, 0.6 + 0.1 * len(run)),
                    message="Sustained low-arousal drift coinciding with lap-time loss"))
                run = []       # one alert per drift episode
    return out


def _red_mist(clips) -> list[Alert]:
    """Frustration spike. Two required conditions, plus corroboration that raises
    confidence rather than gating the alert.

    Speech rate used to be a third mandatory gate ("angry people talk fast"). Real
    radio says otherwise: measured correlation between acoustic arousal and speech
    rate is NEGATIVE (-0.33, n=32), and the clearest angry clip we have — Russell,
    Qatar 2023, "Come on, what the hell? Come on.", scored angry 1.00 by
    emotion2vec+ AND 0.83 by the text model — is slow and clipped at 1.75 syl/s.
    Requiring high rate demanded two things that don't co-occur, and vetoed the
    single most obvious true positive in the dataset.

    So: elevated arousal against the driver's own baseline, plus explicit anger
    evidence from at least one model. Rate and cross-model agreement then scale
    confidence, which is what a pit wall actually needs to triage.
    """
    out = []
    for c in clips:
        cat_ang = c.get("cat_emotion", {}).get("angry", 0)
        txt_ang = c.get("text_emotion", {}).get("anger", 0)
        anger = max(cat_ang, txt_ang)
        if c["arousal_z"] < config.RED_MIST_AROUSAL_Z or anger < config.RED_MIST_ANGER:
            continue

        rate = c.get("prosody", {}).get("rate_sps", 0)
        both_models = cat_ang >= 0.4 and txt_ang >= config.RED_MIST_ANGER
        conf = 0.55 + 0.20 * both_models + 0.10 * (rate > 4.5) \
            + 0.10 * (c["arousal_z"] >= 2.0)

        out.append(Alert(
            type="red_mist",
            t_start=c["t_session_s"],
            laps=[c["lap"]] if c.get("lap") else [],
            evidence={"arousal_z": round(c["arousal_z"], 2),
                      "anger_acoustic": round(cat_ang, 2),
                      "anger_text": round(txt_ang, 2),
                      "rate_sps": round(rate, 2)},
            confidence=round(min(conf, 0.95), 2),
            message="Frustration spike — cool-down call recommended"))
    return out
