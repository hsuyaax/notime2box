# The Silent Co-Driver

**F1 regulates the thermometer. We monitor the human.**

Qatar 2023: a driver vomited in his helmet on lap 15 and raced 40 more laps before the
pit wall found out. Telemetry instruments the car; nobody instruments the human. Drivers
won't self-report — strain leaks into the voice involuntarily. We decode it.

The Silent Co-Driver ingests real F1 team radio (OpenF1) and lap data (FastF1),
transcribes it, reads stress and fatigue from the voice, and tracks the driver's
**hidden mental state across the whole race** — warning the pit wall *before* lap times
fall apart.

## The hard part

Radio clips are sparse, irregular, noisy measurements of a hidden continuous state — so
we track the driver's mind the way NASA tracks a rocket: a **variable-Δt Kalman filter**
(state `[A, V, Ȧ, V̇]`, process noise integrating over radio-silence gaps, dynamic
per-channel measurement trust) fusing acoustic, prosodic and linguistic channels, plus
**Bayesian Online Changepoint Detection** (Adams & MacKay 2007) for regime shifts.
Uncertainty is a first-class output: the UI's confidence band *is* the covariance — it
widens during radio silence and snaps tight when a clip lands. Pure numpy, unit-tested
(`backend/tests/test_engine.py`).

Alerts decide, not describe — and ship with their evidence:
- **Fatigue Drift** — sustained state regime change **and** lap-time degradation.
- **Red Mist** — frustration spike → "cool-down call recommended."

Every score is a z-score against **that driver's own baseline** — Räikkönen's flat is
normal, Norris's animated is calm.

## Model stack (Hugging Face)

| Role | Model |
|---|---|
| Emotion (categorical) | `emotion2vec/emotion2vec_plus_large` |
| Emotion (arousal/valence) | `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` |
| ASR primary | `distil-whisper/distil-large-v3.5` (faster-whisper) |
| ASR fallback (conf-gated) | `jacktol/whisper-medium.en-fine-tuned-for-atc` |
| Text emotion | `j-hartmann/emotion-english-distilroberta-base` |
| VAD | silero-vad |

Five Hub artifacts behind one swappable engine interface (`ENGINE=naive|bayes`),
confidence-gated dual ASR, every stage cached by clip hash.

## Run

```bash
docker compose up          # backend :8000 · frontend :3000
OFFLINE=1 docker compose up   # fully offline from the committed demo bundle
```

Dev, no Docker:

```bash
pip install -r backend/requirements.txt
python -m backend.scripts.seed_demo        # instant demo session
uvicorn backend.app.main:app --port 8000
cd frontend && npm i && npm run dev
```

Optional heavy models (Python ≤3.13): `pip install faster-whisper funasr transformers torch`.
Without them the pipeline degrades to signal-level heuristics and cached outputs —
the demo never depends on a download.

## What's next

Live session ingestion · endurance racing (multi-hour stints — fatigue is THE problem)
· fleet-safety pilot (trucking, dispatch: same voice-only channel, same under-reporting
human).

*Data via OpenF1 (unofficial) & FastF1.*
