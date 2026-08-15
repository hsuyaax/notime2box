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
- **Fatigue Drift** — early-vs-late decline (Hedges g ≥ 0.8) **and** lap-time loss.
- **Red Mist** — frustration spike → "cool-down call recommended."

Every score is a z-score against **that driver's own baseline** — Räikkönen's flat is
normal, Norris's animated is calm.

## What we found in the data

Building this surfaced four problems that only appear when you run real audio through
real models and check the numbers. They are documented here because the fixes are the
most interesting engineering in the repo.

**1. The emotion model was running a random head.** `audeering/wav2vec2-...-msp-dim`
declares a custom `Wav2Vec2ForSpeechClassification`. Loaded through the stock
`pipeline("audio-classification", ...)`, the trained regression head is silently
discarded and replaced with a randomly initialised one. Nothing crashes; inference
returns plausible floats. But arousal spread across 16 real clips was **0.003** — a
constant — which flat-lined every z-score, changepoint and alert downstream. Declaring
the real architecture (`pipeline/audeering_model.py`) took the spread to 0.33. A
`self_check()` guards it, and the cache is versioned so a model change can never serve
stale scores.

**2. The Kalman covariance diverged.** A constant-velocity model is an *integrated*
random walk: variance grows as Δt⁵, so an hour of radio silence reported σ≈197 for a
quantity bounded in [0,1]. Driver arousal is bounded and mean-reverting, so it is now
an Ornstein-Uhlenbeck process whose uncertainty *saturates* — at that driver's own
baseline spread, not a global constant.

**3. BOCPD was fed the smoothed posterior.** Changepoint detection was reading the
Kalman output, i.e. the signal after smoothing had removed the discontinuities it
exists to find. It was silent on every real session. It now runs on observations.

**4. OpenF1 timestamps are unreliable per session.** Montreal 2024 collapses all 16 of
a driver's clips into a 21-second window; for Qatar 2023 and Suzuka it is the filenames
that don't line up instead. Neither source wins everywhere, so a per-session chooser
scores each candidate on how well clips land inside the session window and picks on
evidence.

### Measured, not assumed

The design assumed three channels (acoustic, prosodic, linguistic) would corroborate
each other. On real radio they largely don't:

| pair | correlation (n=32) |
|---|---|
| acoustic ↔ speech rate | **−0.33** |
| acoustic ↔ text negativity | −0.13 |
| speech rate ↔ text negativity | +0.37 |

That is published rather than buried, and it changed the product: Red Mist used to
require high speech rate as a third mandatory gate, which vetoed the clearest true
positive we have — Russell, Qatar 2023, *"Come on, what the hell? Come on."*, scored
angry 1.00 by emotion2vec+ **and** 0.83 by the text model, delivered slowly at 1.75
syl/s. Rate now scales confidence instead of gating the alert.

### Alerts are conservative on purpose

Across 44 real clips, exactly **one** alert fires. The most instructive case is one
that *doesn't*: Russell shows the largest voice decline in the dataset (Hedges
g=+0.67) but lapped **0.81s faster** over the same window, so lap corroboration
correctly refuses a fatigue alert a voice-only system would have raised. Both gates
and both thresholds are shown on screen whether or not they trigger — "no alert" is
only trustworthy if you can see what was measured.

There is no labelled ground truth for F1 driver stress, so no accuracy figure is
claimed. That absence is exactly why the design leans on per-driver baselines,
visible uncertainty and lap corroboration instead.

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

## Adding hero video (optional)

Drop a short (~10–15s, MP4/H.264, under ~8MB) dark ambient clip at
`frontend/public/hero-video.mp4` — the Chapter 01 hero picks it up automatically,
layered under the canvas waveform with a dark scrim for text legibility. No file
present, or `prefers-reduced-motion` on? It falls back to the canvas alone — nothing
breaks either way. Trim/compress with the ffmpeg you already have installed:

```bash
ffmpeg -i input.mp4 -t 15 -vf scale=1920:-2 -crf 28 -an frontend/public/hero-video.mp4
```

Use royalty-free footage only (Pexels, Coverr, Mixkit) — never real F1 broadcast
footage, which is copyrighted and unsafe on a publicly hosted site.

## Run

`demo-data/` ships committed in this repo — real radio audio and real model output for
every session listed in the Garage, all picked by live-queried OpenF1 clip counts
rather than guessed. `OFFLINE=1` serves that bundle with zero external calls; the
in-app picker loads any other 2023-2025 race/driver live when online.

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
