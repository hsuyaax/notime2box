"""Engine interface: score_session(clips, laps) -> (trace, alerts). Both engines implement it."""
from ..contracts import TracePoint, Alert


class StateEngine:
    name = "base"

    def score_session(self, clips: list[dict], laps: list[dict]) -> tuple[list[TracePoint], list[Alert]]:
        raise NotImplementedError


def get_engine(name: str) -> StateEngine:
    if name == "bayes":
        from .kalman import BayesEngine
        return BayesEngine()
    from .naive import NaiveEngine
    return NaiveEngine()
