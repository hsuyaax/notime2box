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
| ASR primary | `distil-whisper/distil-large-v3.5-ct2` (faster-whisper) |
| ASR fallback (conf-gated) | `jacktol/whisper-medium.en-fine-tuned-for-atc` |
| Text emotion | `j-hartmann/emotion-english-distilroberta-base` |
| VAD | silero-vad |

Five Hub artifacts behind one swappable engine interface (`ENGINE=naive|bayes`),
confidence-gated dual ASR, every stage cached by clip hash.

## Run

`demo-data/` ships committed in this repo — real radio audio + real model output for
3 verified sessions (Qatar 2023 Ocon, Montreal 2024 Norris, Silverstone 2025 Ocon,
picked by live-queried OpenF1 clip counts, not guesses). `OFFLINE=1` serves that
bundle with zero external calls.

```bash
docker compose up             # backend :8000 · frontend :3000, OFFLINE=1 by default
OFFLINE=0 docker compose up   # also allows loading new sessions live
```

Dev, no Docker:

```bash
pip install -r backend/requirements.txt   # light — no ML deps, serves demo-data as-is
OFFLINE=1 uvicorn backend.app.main:app --port 8000
cd frontend && npm i && npm run dev
```

**Full live inference** (real models instead of heuristic fallback on Try-the-Cockpit,
or to prefetch new sessions) needs the heavy stack on Python ≤3.12:

```bash
py -3.12 -m venv .venv312
.venv312\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cu128   # or plain `pip install torch` for CPU-only
.venv312\Scripts\pip install -r backend\requirements.txt -r backend\requirements-ml.txt
OFFLINE=0 ENGINE=bayes .venv312\Scripts\python -m uvicorn backend.app.main:app --port 8000
.venv312\Scripts\python -m backend.scripts.prefetch_demo    # re-fetch/refresh demo-data
.venv312\Scripts\python -m backend.scripts.bench_asr 2023_qatar_R_OCO --top 4
```

## Hosting a live public link

**Frontend → Vercel** (free): connect the GitHub repo, root directory `frontend/`,
set env var `NEXT_PUBLIC_API=https://<your-backend-url>`. Zero config beyond that —
Next.js is a first-class Vercel target.

**Backend → Fly.io** (`fly.toml` at repo root, free/cheap tier): the default profile
ships `OFFLINE=1` with `requirements.txt` (light, no torch) — serves the 3 committed
real sessions instantly, no GPU needed, fast cold starts. `fly.toml` mounts a
persistent volume at `/data` so the SQLite DB + audio survive redeploys.

```bash
fly launch --no-deploy         # pick a unique app name when prompted, replacing
                                # the placeholder in fly.toml
fly volumes create codriver_data --size 1
fly deploy
```

That's the whole public site with real data, no ongoing GPU cost. If you also want
Try-the-Cockpit to run real models live in production (not the heuristic fallback),
switch the Fly build to `requirements-ml.txt` and provision a GPU machine
(`fly machine update --vm-gpu-kind a10 ...`) — meaningfully more expensive, optional.

## What's next

Live session ingestion · endurance racing (multi-hour stints — fatigue is THE problem)
· fleet-safety pilot (trucking, dispatch: same voice-only channel, same under-reporting
human).

*Data via OpenF1 (unofficial) & FastF1.*
