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
FATIGUE_AROUSAL_Z = -1.2          # retained for the naive engine's simpler rule
FATIGUE_MIN_CLIPS = 3
# Hedges' g on early-vs-late arousal. 0.8 is the conventional "large effect"
# boundary; a pit-wall alert that pulls a driver's race into question should not
# fire on a small or medium effect.
FATIGUE_EFFECT_SIZE = float(os.getenv("FATIGUE_EFFECT_SIZE", "0.8"))
# Resolution floor for arousal. Effect sizes are never claimed more precisely than
# the model itself resolves, and it stops a low-variance window sending d -> inf.
AROUSAL_NOISE_SD = 0.02
FATIGUE_LAP_DELTA_S = 0.25
# 1.2 == the 90th percentile of arousal_z across our real clips: "clearly above
# THIS driver's normal". Not a number chosen to make something fire — the anger
# gate below is the binding constraint (only 2 of 44 real clips reach anger>=0.5,
# where the 95th percentile of anger is 0.08), and 1.0/1.2/1.5 all yield the same
# single alert on real data. 1.8 fired on nothing, including a clip both emotion
# models scored as unambiguously angry.
RED_MIST_AROUSAL_Z = 1.0 if DEMO_PROFILE else 1.2
RED_MIST_ANGER = 0.35 if DEMO_PROFILE else 0.5

for d in (DATA_DIR, CACHE_DIR, AUDIO_DIR):
    d.mkdir(parents=True, exist_ok=True)
