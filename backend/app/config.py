"""Central config. Everything overridable by env var; defaults per FINAL-SOLUTION Part B3."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # repo root
load_dotenv(ROOT / ".env")  # HF_TOKEN etc — huggingface_hub reads HF_TOKEN automatically
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "demo-data"))
CACHE_DIR = Path(os.getenv("CACHE_DIR", DATA_DIR / "cache"))
AUDIO_DIR = Path(os.getenv("AUDIO_DIR", DATA_DIR / "audio"))
DB_PATH = Path(os.getenv("DB_PATH", DATA_DIR / "codriver.sqlite"))

ENGINE = os.getenv("ENGINE", "naive")            # naive | bayes
ASR_CONF_GATE = float(os.getenv("ASR_CONF_GATE", "0.55"))
EWMA_ALPHA = float(os.getenv("EWMA_ALPHA", "0.3"))
BOCPD_HAZARD = float(os.getenv("BOCPD_HAZARD", "8"))
OFFLINE = os.getenv("OFFLINE", "0") == "1"
DEMO_PROFILE = os.getenv("DEMO_PROFILE", "0") == "1"

# Alert thresholds (Part C4); DEMO_PROFILE relaxes red-mist for the live mic bit.
# ponytail: 0.3 not the paper's 0.8 — Kalman smoothing turns steps into ramps, so
# BOCPD spikes are damped on real (gradual) fatigue; retune if raw-obs BOCPD lands
FATIGUE_P_CHANGE = float(os.getenv("FATIGUE_P_CHANGE", "0.3"))
FATIGUE_AROUSAL_Z = -1.2
FATIGUE_MIN_CLIPS = 3
FATIGUE_LAP_DELTA_S = 0.25
RED_MIST_AROUSAL_Z = 1.2 if DEMO_PROFILE else 1.8
RED_MIST_ANGER = 0.35 if DEMO_PROFILE else 0.5

for d in (DATA_DIR, CACHE_DIR, AUDIO_DIR):
    d.mkdir(parents=True, exist_ok=True)
