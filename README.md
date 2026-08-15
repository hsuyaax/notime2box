# The Silent Co-Driver

Formula 1 instruments the car to the millimetre. Nobody instruments the human.

Every driver is on the radio all race. That audio already carries fatigue, frustration
and cognitive load — it is simply never decoded. This project decodes it: it takes real
team radio, separates the driver from his race engineer, scores each call for emotional
arousal, and estimates the driver's hidden state over the race with explicit uncertainty.

It raises exactly two alerts, and it is designed to stay quiet.

---

## What it actually does

```
team radio (OpenF1)  ──┐
                       ├──▶  VAD ──▶ ASR ──▶ ┬─ acoustic arousal/valence
lap times (FastF1)   ──┘                     ├─ categorical emotion
                                             ├─ text emotion
                                             └─ prosody (rate, pauses, pitch var)
                                                        │
                              speaker separation ◀──────┤
                              (driver vs engineer)      │
                                                        ▼
                                        state estimator (Kalman + BOCPD)
                                                        │
                                                        ▼
                                             alerts, gated on lap times
```

**Two alerts, both deliberately hard to trigger:**

- **Red Mist** — a frustration spike. Requires acoustic anger *and* independent
  agreement from the text model, scored against the driver's own baseline.
- **Fatigue Drift** — a sustained decline across the race. Requires a Hedges' *g*
  effect size ≥ 0.8 on voice **and** corroborating lap-time degradation. Voice alone is
  not enough, so a driver who sounds tired but is still fast raises nothing.

On the bundled corpus this produces **one** alert across 179 clips. That is the point.
Thresholds were never tuned down to make the demo livelier.

---

## Design decisions worth defending

**Every score is relative to the driver's own baseline.** Räikkönen's flat delivery is
normal; Norris's animated delivery is calm. Absolute thresholds are meaningless here, so
the system reports z-scores against a per-driver baseline and nothing else.

**Uncertainty is rendered, not hidden.** The state estimator is an Ornstein-Uhlenbeck
Kalman filter. Its covariance widens while the radio is silent and snaps tight when a
clip lands, and the UI draws that band. A constant-velocity filter was tried first and
diverged to σ≈197 on a [0,1] quantity after an hour of silence; OU dynamics mean-revert
to the driver's own baseline spread instead.

**Changepoints come from the observations.** Bayesian Online Changepoint Detection
(Adams & MacKay, 2007) runs on raw arousal, not on the smoothed posterior — feeding it
the filter's own output made it silent, because the smoother had already removed the
discontinuities it exists to find.

**The driver is separated from the engineer before anything is scored.** Team radio
carries both sides and labels neither. Scoring an engineer's calm status call as the
driver's emotional state corrupts everything downstream. Separation is semi-supervised:
lexical seeds (forms of address, the driver's own first name) bootstrap labels, which
propagate through wav2vec2 speaker embeddings via k-means. Clips that stay ambiguous are
labelled `unknown` and retained for state estimation — on a twelve-clip session,
discarding everything unnamed throws away most of the race on a guess.

**No accuracy figure is claimed.** There is no labelled ground truth for F1 driver
stress. Rather than quote a number that cannot be defended, the design leans on relative
baselines, multi-signal agreement, visible uncertainty and lap-time corroboration.

**Measured, not assumed.** The premise was that voice, rhythm and words would corroborate
each other. They do not. Acoustic arousal and speech rate correlate at **−0.30** (n=168)
— the opposite sign to the assumption the system was built on. This is displayed in the
UI rather than buried, and it changed the product: the anger rule originally required
fast speech, which vetoed the clearest angry clip in the corpus because that driver was
angry slowly.

---

## Models

| Role | Model |
|---|---|
| ASR (primary) | `distil-whisper/distil-large-v3.5-ct2` via CTranslate2 |
| ASR (radio-degraded fallback) | `jacktol/whisper-medium.en-fine-tuned-for-atc` |
| Arousal / valence / dominance | `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` |
| Categorical emotion | `iic/emotion2vec_plus_large` |
| Text emotion | `j-hartmann/emotion-english-distilroberta-base` |
| Voice activity detection | `snakers4/silero-vad` |

**On the audeering model.** Its checkpoint declares a custom
`Wav2Vec2ForSpeechClassification` head. Loading it through the stock
`pipeline("audio-classification")` silently substitutes a randomly initialised head —
inference still returns confident, plausible-looking numbers. Measured arousal spread
across sixteen real clips was **0.003**, effectively a constant, and every downstream
signal was dead without a single error being raised. `backend/app/pipeline/audeering_model.py`
declares the real architecture; spread went to 0.33. It ships with a `self_check()` that
asserts a minimum spread over real clips, because this class of failure is invisible
unless you look at the distribution.

---

## Running it

Python **3.12** is required — `torch`, `faster-whisper` and `funasr` do not support 3.13+.

```bash
# backend
python3.12 -m venv .venv312
.venv312/Scripts/pip install -r backend/requirements.txt      # API only
.venv312/Scripts/pip install -r backend/requirements-ml.txt   # + models
.venv312/Scripts/python -m uvicorn backend.app.main:app --port 8000

# frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:3000.

All six models warm at startup. Check readiness before relying on inference:

```bash
curl http://localhost:8000/health
# {"ready": true, "mic_scoring": "real models", "models": {...}}
```

### Offline operation

```bash
OFFLINE=1
```

Serves entirely from the local cache and the bundled corpus — no network calls, including
none to HuggingFace. Warm the session catalog once while online so the race and driver
pickers still populate offline:

```bash
python -m backend.scripts.warm_catalog
```

### Configuration

Every value in `backend/app/config.py` is overridable by environment variable. The ones
that matter:

| Variable | Default | Meaning |
|---|---|---|
| `ENGINE` | `naive` | `naive` (z-score + EWMA) or `bayes` (Kalman + BOCPD) |
| `OFFLINE` | `0` | Local cache only, no network |
| `FATIGUE_EFFECT_SIZE` | `0.8` | Hedges' *g* required for a fatigue alert |
| `FATIGUE_LAP_DELTA_S` | `0.25` | Lap-time degradation required to corroborate |
| `ASR_CONF_GATE` | `0.55` | Below this, fall back to the ATC-tuned ASR |
| `BOCPD_HAZARD` | `8` | Expected run length between regimes |

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Per-model readiness |
| `GET /api/sessions` | Processed sessions with driver-clip counts |
| `GET /api/sessions/{key}/clips` | Scored clips, with speaker labels |
| `GET /api/sessions/{key}/trace?engine=` | State estimate, alerts, laps, fatigue diagnostics |
| `GET /api/sessions/{key}/wrapped/{drv}` | Session summary |
| `POST /api/sessions/{key}/load` | Fetch and process a new session |
| `GET /api/sessions/{key}/progress` | SSE progress for the above |
| `POST /api/mic/score` | Score a recorded clip (`?baseline=1` to capture a baseline) |
| `POST /api/upload` | Score an uploaded audio file |
| `GET /api/catalog/{year}` | Races, cached |
| `GET /api/catalog/{year}/drivers` | Drivers for a session, cached |

The frontend contains no fixture or fallback data. If the backend is unreachable the UI
renders empty rather than substituting something that looks real.

---

## Layout

```
backend/app/
  pipeline/     audio → VAD → ASR → emotion/prosody → speaker separation
  engine/       naive and bayesian estimators, BOCPD, alert gating
  data/         OpenF1 and FastF1 clients
  contracts.py  frozen schemas; the frontend mirrors these in lib/api.ts
frontend/
  app/          single scrolling narrative, six chapters
  components/   charts, clip rail, cockpit
demo-data/      bundled audio corpus and SQLite store
```

```bash
pytest backend/tests -q     # 12 passed
```

Tests cover Kalman convergence and non-divergence under long silences, BOCPD changepoint
recovery, and that alert gating rejects voice-only evidence.

---

## Data

Team radio and session metadata from [OpenF1](https://openf1.org) (unofficial, no auth).
Lap timing from [FastF1](https://docs.fastf1.dev). Bundled corpus: 15 processed sessions,
179 clips, 2023–2025.

Not affiliated with, endorsed by, or connected to Formula 1, the FIA, or any team.
