"""Naive engine: z-scores -> EWMA -> threshold alerts. Ships first; the guaranteed demo."""
from .. import config
from ..contracts import TracePoint, Alert
from .base import StateEngine
from .alerts import detect_alerts


class NaiveEngine(StateEngine):
    name = "naive"

    def score_session(self, clips, laps):
        a = config.EWMA_ALPHA
        trace: list[TracePoint] = []
        ma, mv = 0.5, 0.5
        for i, c in enumerate(clips):
            ma = a * c["arousal"] + (1 - a) * ma
            mv = a * c["valence"] + (1 - a) * mv
            trace.append(TracePoint(t=c["t_session_s"], mean=[ma, mv],
                                    std=[0.1, 0.1], p_change=0.0, regime_id=0))
        alerts = detect_alerts(clips, trace, laps)
        return trace, alerts
