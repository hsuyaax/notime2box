"""Frozen data contracts (FINAL-SOLUTION Part B2). Front & back build against these."""
from pydantic import BaseModel
from typing import Optional


class Prosody(BaseModel):
    rate_sps: float = 0.0        # syllables/sec proxy (voiced onsets per second)
    pause_ratio: float = 0.0
    f0_var: float = 0.0


class ClipScore(BaseModel):
    clip_id: str
    t_session_s: float
    lap: Optional[int] = None
    audio_url: str = ""
    duration_s: float = 0.0
    transcript: str = ""
    asr_conf: float = 0.0
    asr_model: str = "none"                     # distil | atc | none
    word_confs: list[tuple[str, float]] = []    # per-word transcript opacity in UI
    arousal: float = 0.5
    valence: float = 0.5
    arousal_z: float = 0.0
    valence_z: float = 0.0
    cat_emotion: dict[str, float] = {}
    prosody: Prosody = Prosody()
    text_emotion: dict[str, float] = {}
    label: str = "calm"           # calm | elevated | stressed | tired | uncertain
    confidence: float = 0.0
    signals_agree: bool = False
    signal_spread: float = 0.0    # 0=all three channels agree, 1=maximal conflict
    speaker: str = "unknown"      # driver | engineer | unknown — team_radio carries
                                  # BOTH sides of the conversation and labels neither


class TracePoint(BaseModel):
    t: float
    mean: list[float]            # [A, V]
    std: list[float]             # [σA, σV] — the UI band is mean ± 1.5σ
    p_change: float = 0.0
    regime_id: int = 0


class Alert(BaseModel):
    type: str                    # fatigue_drift | red_mist
    t_start: float
    t_end: Optional[float] = None
    laps: list[int] = []
    evidence: dict[str, float] = {}
    confidence: float = 0.0
    message: str = ""


class LapPoint(BaseModel):
    lap: int
    lap_time_s: Optional[float] = None
    t_start_s: float = 0.0
    is_pit: bool = False


class SessionMeta(BaseModel):
    key: str                     # e.g. "2023_qatar_R_OCO"
    year: int
    gp: str
    session: str = "R"
    driver: str
    driver_number: Optional[int] = None
    clip_count: int = 0
    ready: bool = False
