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
    out = []
    for c in clips:
        angry = c.get("cat_emotion", {}).get("angry", 0) >= 0.4 \
            or c.get("text_emotion", {}).get("anger", 0) >= config.RED_MIST_ANGER
        rate_up = c.get("prosody", {}).get("rate_z", 0) > 0 or c.get("prosody", {}).get("rate_sps", 0) > 4.5
        if c["arousal_z"] >= config.RED_MIST_AROUSAL_Z and angry and rate_up:
            out.append(Alert(
                type="red_mist",
                t_start=c["t_session_s"],
                laps=[c["lap"]] if c.get("lap") else [],
                evidence={"arousal_z": round(c["arousal_z"], 2),
                          "anger": round(max(c.get("cat_emotion", {}).get("angry", 0),
                                             c.get("text_emotion", {}).get("anger", 0)), 2),
                          "rate_sps": round(c.get("prosody", {}).get("rate_sps", 0), 2)},
                confidence=round(min(0.95, c.get("confidence", 0.5) + 0.2), 2),
                message="Frustration spike — cool-down call recommended"))
    return out
