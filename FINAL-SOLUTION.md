# THE SILENT CO-DRIVER — FINAL SOLUTION
### The single document to follow from first commit to final answer in Q&A.
*Haas F1 Hackathon · Problem Statement 1 · "Reading driver stress from radio calls"*

---

## PART A — WHAT WE ARE BUILDING AND WHY

### A1. Executive summary

The Silent Co-Driver ingests a driver's radio calls, decodes the stress and fatigue leaking involuntarily through the voice, tracks the driver's **hidden mental state across the whole race** using Bayesian state estimation (a variable-Δt Kalman filter + online changepoint detection), and warns the pit wall **before** lap times fall apart. It pulls **real F1 radio and lap data** (OpenF1 + FastF1), runs five Hugging Face models orchestrated by our own inference engine, and presents everything on a cinematic, driver-website-grade frontend.

**The one-liner:** *F1 regulates the thermometer. We monitor the human.*
**The technical one-liner:** *Radio clips are sparse, noisy measurements of a hidden state — so we track a driver's mind the way NASA tracks a rocket.*

### A2. The narrative foundation (memorise; this is the pitch spine)

1. **Qatar 2023.** Ocon vomited in his helmet on laps 15–16 and raced 40 more laps — the pit wall found out afterwards. Sargeant retired dehydrated; Stroll reported near-blackouts; Russell's struggle began at lap 20 of 57 and he asked his engineer for encouragement just to cope. Cockpits neared 50°C. Every one of these drivers talked on the radio all race; their voices degraded lap by lap; every pit wall watched sector times instead. **The telemetry showed cars that were fine. The humans were not.**
2. **The regulatory proof of the gap.** The FIA's fix was a cooling kit mandated by a *weather threshold*. Regulation instrumented the input (air temperature), not the output (the human's actual condition).
3. **Why voice, specifically.** Racing culture punishes admitted weakness; drivers under-report until they vomit or retire. Strain leaks into the voice **involuntarily** — pitch, rate, pauses, spectral tension. We chose the one signal the driver cannot suppress, because the signal he controls (what he says) is unreliable in this population.
4. **The organiser's own stakes.** The Qatar driver now drives for the organising team. The team principal is an ex-race engineer publicly saying the car's inconsistency makes his driver evaluation for 2027 nearly impossible. The rookie teammate sits close to an automatic race ban on penalty points — most of which come from red-mist moments. The team is the leanest on the grid and wins by leverage, not headcount. Every feature below maps to one of these.
5. **Beyond F1.** Same failure mode (voice-only channel, under-reporting human, metric-watching supervisor) in trucking fleets, ATC, mining dispatch, endurance racing. *"We built it on F1 radio because the data is open and the demo is fun — the architecture is fleet safety."*

### A3. Locked feature set

**Brief compliance (table stakes):** upload/play clip ✅ · speech→text ✅ · calm/stressed/tired ✅ · mood-vs-lap-time visualization ✅ · frontend+backend ✅ · Hugging Face Hub ✅ · balanced difficulty ✅.

**Differentiators:**
- **D1 — Real races, not uploads.** Select any 2023–2025 race + driver → real radio MP3s (OpenF1) + laps (FastF1) auto-populate the timeline. Upload remains a secondary path. (2026 radio coverage collapsed upstream — we demo 2023–2025 and say why; knowing your data reads as competence.)
- **D2 — Per-driver baseline calibration.** All clips scored, per-driver mean/σ computed, every clip reported as a **z-score vs the driver's own normal** — because Räikkönen's flat is normal and Norris's animated is calm. Absolute thresholds are wrong in this domain. *"Our system knows Verstappen's angry is Kimi's Tuesday."*
- **D3 — Fatigue Drift Alerts.** Rolling Driver State Index fusing acoustic emotion + linguistic signal + prosody trend; alert fires only when sustained state degradation **coincides with lap-time degradation**. Charts describe; alerts decide. Three weak votes beat one confident guess; disagreement renders as "low confidence," never a forced label.
- **D4 — The Bayesian engine** (the hard core; full spec Part C).

**Team-value features:** **Season Ledger** (cross-race state trends + one-page weekend debrief → the objective evidence channel for driver-vs-car evaluation) · **Red Mist Alert** (frustration spike → "cool-down call recommended"; penalty-point mitigation) · **Composure Curve** (rookie maturation metric on recurring situations: restarts, traffic, last-lap pressure).

**Heart-and-fun layer:** **Try the Cockpit** (judge mic demo — choreography Part F) · **Radio Rewind** (cinematic replay scrubber, the centrepiece screen) · **Race Wrapped** (shareable post-race card) · **Steiner easter egg** (levels rename to "calm / spicy / full Guenther" — a wink in settings, never the centrepiece).

### A4. Model stack (locked)

| Role | HF artifact | Why |
|---|---|---|
| Emotion, categorical | `emotion2vec/emotion2vec_plus_large` (fallback `_base`) | SER foundation model built to overcome recording-environment effects — our exact problem (compressed radio); outperforms other high-download open SER models. |
| Emotion, dimensional | `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` | Continuous arousal/valence/dominance ∈ [0,1] — raw material for z-scores and the Kalman state. Mapping (ours): high A + low V → stressed; low A → tired; mid A + ok V → calm. |
| ASR primary | `distil-whisper/distil-large-v3.5` via faster-whisper | Near large-v3 accuracy, fraction of latency; demo stays snappy. |
| ASR fallback | `jacktol/whisper-medium.en-fine-tuned-for-atc` | ATC audio ≈ F1 radio acoustically (compressed, clipped, jargon); author reports WER 94.6→15.1% in-domain. Runs **only** when primary confidence < gate. |
| Text emotion | `j-hartmann/emotion-english-distilroberta-base` | Tiny, battle-tested; the linguistic vote when the audio is filthy. |
| VAD | `pyannote/voice-activity-detection` (or silero-vad if HF auth is a headache) | Trims beeps/static first; half of "model is bad" is "you fed it static." |

Five Hub artifacts orchestrated by our own inference framework: past "one ready-made tool" from one side, past "from scratch" from the other — the brief's balanced-difficulty target, exactly.

### A5. Open projects we build on

OpenF1 (radio MP3s + laps/positions; unofficial — credit on slide) · FastF1 (lap/telemetry DataFrames, de-facto standard) · harningle/tr-transcription (preprocessing tricks for this exact audio) · jack-tol's ATC Whisper work (domain ASR) · slowlydev/f1-dash ~2k★ (dark timing-screen taste reference — study, then out-style) · pitwall & undercut-f1 (prior art proving radio+replay works and that nobody added state estimation — our gap).

---

## PART B — SYSTEM ARCHITECTURE

```
┌────────────────────────── FRONTEND · Next.js ──────────────────────────┐
│ Garage (select) · Radio Rewind (centrepiece) · Debrief (Ledger+Wrapped)│
│ Try-the-Cockpit (mic) · Alert feed · Engine toggle · Steiner toggle    │
└──────────────▲─────────────────────────────────────────▲──────────────┘
               │ REST (JSON, typed contracts)            │ SSE (progress)
┌──────────────┴──────────────── BACKEND · FastAPI ──────┴──────────────┐
│ DATA LAYER      OpenF1 client (radio URLs, meta) · FastF1 (laps, cached)│
│ AUDIO PIPELINE  ffmpeg loudnorm 16 kHz mono → VAD trim                 │
│  (per clip,      → ASR primary → [conf < 0.55] → ASR ATC fallback      │
│   parallel)      → emotion2vec+ ∥ audeering ∥ librosa prosody          │
│                  → text emotion on transcript                          │
│                  → ClipScore {A, V, z, label, conf, signals{}}         │
│ STATE ENGINE    interface: score_session(clips, laps) → StateTrace     │
│  (swappable)     engine=naive  z-score + EWMA          (ships first)   │
│                  engine=bayes  Kalman(var-Δt, 3-ch fusion) + BOCPD     │
│ ALERTS          fatigue_drift · red_mist (evidence dicts attached)     │
│ STORAGE         SQLite + /cache keyed by clip hash (idempotent, resume)│
└────────────────────────────────────────────────────────────────────────┘
```

**Non-negotiable design rules:** every stage caches by clip hash (instant re-demos, free crash recovery) · both engines behind one interface (swap = config flag; ambition never blocks the demo) · all models load once at startup in a ModelRegistry · `OFFLINE=1` runs fully from the committed demo bundle.

### B1. Repository layout

```
silent-codriver/
├── backend/app/
│   ├── main.py  config.py  registry.py  store.py
│   ├── data/       openf1.py  fastf1_client.py
│   ├── pipeline/   audio.py  asr.py  emotion.py  prosody.py
│   │               text_emotion.py  clipscore.py
│   ├── engine/     base.py  naive.py  kalman.py  bocpd.py  alerts.py
│   └── routes/     sessions.py  process.py  trace.py  mic.py  wrapped.py
├── backend/scripts/ prefetch_demo.py  bench_asr.py
├── frontend/app/    page.tsx(Garage)  rewind/[session]/  debrief/[session]/  cockpit/
├── frontend/components/ LapStressChart Waveform AlertCard ConfidenceBand
│                        DriverCard WrappedCard SteinerToggle
├── demo-data/       ← committed offline bundle (audio + cached outputs + SQLite)
├── docker-compose.yml
└── README.md        ← judges read this; skeleton in Part G
```

### B2. Data contracts (freeze in Phase 0; front & back build in parallel against them)

```jsonc
// ClipScore
{ "clip_id":"ocn_q2023_r_014", "t_session_s":3121.4, "lap":34,
  "audio_url":"...", "duration_s":4.2,
  "transcript":"tyres are gone, I have no grip",
  "asr_conf":0.81, "asr_model":"distil|atc",
  "arousal":0.74, "valence":0.22, "arousal_z":1.9, "valence_z":-1.4,
  "cat_emotion":{"angry":0.55,"neutral":0.20}, 
  "prosody":{"rate_sps":4.9,"pause_ratio":0.31,"f0_var":812},
  "text_emotion":{"anger":0.60},
  "label":"stressed", "confidence":0.77, "signals_agree":true }

// StateTrace point
{ "t":3121.4, "mean":[0.71,0.25], "cov":[[...]], "p_change":0.12, "regime_id":3 }

// Alert
{ "type":"fatigue_drift|red_mist", "t_start":..., "laps":[38,44],
  "evidence":{"arousal_z":-1.8,"rate_delta_pct":-12,"lap_delta_s":0.4},
  "confidence":0.83, "message":"Sustained low-arousal drift coinciding with lap-time loss" }
```

### B3. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/sessions` | GET | Demo-ready sessions (year, gp, drivers, clip counts) |
| `/api/sessions/{key}/load` | POST | Fetch radio+laps, enqueue processing → SSE channel id |
| `/api/sessions/{key}/progress` | SSE | Per-clip progress → pit-board loading UI |
| `/api/sessions/{key}/clips` | GET | All ClipScores |
| `/api/sessions/{key}/trace?engine=` | GET | StateTrace + alerts + laps joined |
| `/api/mic/score` | POST audio | Try-the-Cockpit one-shot (≤2 s budget); `?baseline=1` stores take-1 stats |
| `/api/sessions/{key}/wrapped/{drv}` | GET | Wrapped card payload |
| `/api/upload` | POST | Brief-required manual path (reuses mic pipeline + optional lap CSV) |

Config defaults: `ENGINE=naive · ASR_CONF_GATE=0.55 · EWMA_ALPHA=0.3 · BOCPD_HAZARD=8 · OFFLINE=0 · DEMO_PROFILE=0`.

---

## PART C — THE CORE ENGINE (the hard part, fully specced)

### C1. Why this and not a classifier
Radio clips are sparse, irregular, noisy observations of a hidden continuous variable. The driver's state exists every second; we measure it ~4 s every few laps through three unreliable instruments. Per-clip classification (what every other team will do) throws away the structure of the problem. Principled uncertainty is also the *product*: a pit-wall tool that can say "I'm not sure right now" is trustable; an always-confident classifier is a toy.

### C2. Stage 1 — Kalman filter, variable Δt, 3-channel fusion
State `x = [A, V, Ȧ, V̇]ᵀ` (levels + slow trends).

```
Predict over gap Δt:
  F(Δt) = [[1,0,Δt,0],[0,1,0,Δt],[0,0,1,0],[0,0,0,1]]
  Q(Δt) = q·G(Δt)G(Δt)ᵀ          # process noise integrates over the gap →
  x ← F x ;  P ← F P Fᵀ + Q       # uncertainty GROWS during radio silence
Update per clip (stack up to 3 channels):
  channels: acoustic A,V (audeering) · prosody→A · text→V
  R_ch = base_R / (asr_conf · snr_norm · agreement_bonus)   # dynamic trust
  standard Kalman update, H stacked, R = diag(R_ch)
Init: x₀ from driver baseline (first ⌈20%⌉ of clips or practice clips), P₀ wide.
Output: mean + covariance per step → the UI's confidence band IS the covariance.
```
Pure numpy, no filterpy, ~200 lines with docstrings — the point is that *we* did the thinking.
**Unit tests (write them; they are also a Q&A exhibit):** silence → variance strictly grows · high-conf clip → posterior var < prior · synthetic regime shift → trace follows within k steps.

### C3. Stage 2 — BOCPD (Adams & MacKay 2007)
Run-length posterior `p(r_t | x_{1:t})`, hazard `1/λ` with λ≈8 clips, Normal-Inverse-Gamma conjugate likelihood on the Kalman arousal mean. Emit `p_change(t) = p(r_t=0)`; regimes labelled by argmax run length; truncate run-length dist at 50 and renormalise (bounded memory). Unit test: synthetic step-change → P(change) spikes at the step, nowhere else.

### C4. Alert rules (deliberately simple ON TOP of sophisticated inference)
```
FATIGUE DRIFT: p_change>0.8 AND new regime arousal_z ≤ −1.2 sustained ≥3 clips
               AND rolling lap delta ≥ +0.25 s vs driver's clean-air median
RED MIST:      arousal_z ≥ +1.8 AND (angry ∨ text-anger ≥ 0.5) AND rate > baseline
               → "cool-down call recommended"
Evidence dict attached verbatim → UI renders rows → explainability for free.
```

### C5. Naive engine (ships FIRST, same interface)
z-scores → EWMA(α=0.3) → threshold alerts. ~40 lines. This is the guaranteed demo; the Bayesian engine is a drop-in behind the same API, toggled live in the UI (judges watch the trace change character).

---

## PART D — FRONTEND (driver-website energy, not dashboard energy)

### D1. Design system
```
--bg:#0A0A0A  --panel:#111214  --line:#26282B  --red:#E6002B(Haas)
--white:#F4F4F4  --amber:#FFB800  --green:#00C853
Display: Archivo Expanded 900, numerals italic −5° (speed) · Body: Inter
Panels: clip-path cut corners (8px, 45°) — never border-radius
Texture: 3% noise overlay + 1px telemetry rules
Motion: transform/opacity only · 200–400 ms · ease-out · Framer Motion
Stack: Next.js + Tailwind + Framer Motion + wavesurfer.js + visx + html-to-image
```

### D2. Screens (three, polished; nothing else)
- **Garage.** Full-bleed driver cards, giant race numbers in display italic, session segmented control. Selection → SSE loading styled as a pit board ("PULLING RADIO… 14/23"). Hover: 1.02 scale + red underline sweep.
- **Radio Rewind** *(centrepiece — 40% of frontend time)*. Shared x-axis: lap-time line (visx, pit laps ghosted) above; **state trace with confidence band** (±1.5σ from Kalman cov — visibly widens in radio silence: the algorithm on screen) below. Pulsing clip markers coloured green/amber/red; click → panel slides up with emotion-tinted wavesurfer waveform, transcript with per-word ASR-confidence opacity, signal mini-bars (acoustic/prosody/text), z-scores. Drag scrubber sweeps both charts; alerts fire as FIA-race-control-styled toast cards (monospace, timestamp, evidence rows). Engine toggle top-right; Steiner toggle in settings.
- **Debrief.** Wrapped card (4:5 portrait, PNG download) + Season Ledger table (per-race state score, sparkline per driver, composure-curve chart).
- **Try the Cockpit.** Full-screen mic button, 5 s cap (MediaRecorder), two-take flow (Part F), animated gauge + label + transcript + Red Mist card.

---

## PART E — DATA & DEMO PLAN

1. **Sessions to pre-fetch** (`scripts/prefetch_demo.py`, outputs committed to `demo-data/`):
   Qatar 2023 Race — Ocon (the story clip; Alpine era, still him) · one 2024 race with dense radio for a top driver (pick by OpenF1 clip count) · one 2025 Haas session (Ocon/Bearman at Haas).
2. `scripts/bench_asr.py` ranks clips by ASR confidence → lock **3–4 hero clips** for live use; the noisy ones become the "this is why the ATC fine-tune exists" talking point.
3. **Offline bundle**: audio + all cached model outputs + SQLite snapshot committed; `OFFLINE=1` skips all network. The full demo must run with WiFi off.
4. Slide courtesy line: *"data via OpenF1 (unofficial) & FastF1."*

---

## PART F — DEMO CHOREOGRAPHY & PITCH (follow verbatim, then make it yours)

### F1. Which alert goes where — and the line that sells it
**Red Mist fires live in the mic demo. Fatigue Drift is never attempted live** — it is by design a multi-clip regime change corroborated by lap deltas; one mic clip cannot fire it, and rigging it would violate our own engine's rules in front of the exact judges who'd catch it. Deliver the split as a feature:
> *"Two alerts. One you can trigger yourself right now. The other, by design, you can't — because fatigue is a regime, not a moment. For that one: Qatar."*
This turns "we can't demo it live" into proof the system resists false positives.

### F2. Try the Cockpit — two-take sequence (90 s, quietly demos baseline calibration live)
- **Take 1 (calm).** Judge card #1: *"Understood, box this lap, box box."* Gauge sits green; "BASELINE CAPTURED" chip appears. Line: *"The system just learned what calm sounds like — for you specifically."*
- **Take 2 (meltdown).** Judge card #2: *"I told you the tyres were gone three laps ago! Why are we ALWAYS last on strategy?!"* Gauge swings red; arousal z vs THEIR take-1 renders; Red Mist card fires with evidence rows (arousal +2.3σ · anger 0.7 · rate +18%) and "cool-down call recommended."
- **The button:** *"That z-score is against your baseline from thirty seconds ago — the same math that knows Verstappen's angry is Kimi's Tuesday."*
- **Safeguards:** `DEMO_PROFILE=1` relaxed thresholds tuned on your own voices; test on the demo laptop's mic; 5 s cap; a recorded backup video of the sequence (a mic demo without a fallback is a coin flip).

### F3. Pitch arc (6 beats, ~5 min; every 30-s beat lands with a different judge persona — bake angles in, never name people)
1. **Cold open (story).** Real Ocon clip → live pipeline → spike on screen. *"Qatar 2023. He was vomiting in his helmet. The pit wall found out afterwards. He's your driver now."*
2. **The gap.** Telemetry instruments the car; nobody instruments the human. The FIA fixed the thermometer, not the monitoring. Self-report is broken here; voice is the signal a driver can't suppress.
3. **Demo.** Radio Rewind full race → point at the confidence band widening in silence → Red Mist toast → **mic sequence (F2)**.
4. **The hard part (30 s, for the technical judges).** *"Radio clips are sparse noisy measurements of a hidden state, so we track the mind like a rocket: variable-Δt Kalman fusion of acoustic, prosodic and linguistic channels, plus Bayesian online changepoint detection. That band you saw widening — that's the covariance."* Flip the engine toggle live.
5. **Built right (one breath, for the systems judges).** *"Five Hugging Face models behind one swappable engine interface, confidence-gated dual ASR, every stage cached by clip hash, and the whole demo runs offline."*
6. **Value & close (for product judges).** Season Ledger → *"the team is publicly wrestling with a driver-evaluation decision the data can't settle; this is the missing data channel."* Composure Curve for the rookie. Then: *"Smallest team on the grid has always won by leverage, not headcount — this is leverage."* Final sentence: fleet safety.

### F4. Q&A preparation
**Hidden appendix slide — "Known Failure Modes"** (deploy when asked where it breaks; answering a hostile-shaped question with a prepared slide is the most senior-looking move in a hackathon):
- Emotion models trained on acted speech → mitigated by relative per-driver z-scores, never absolute thresholds.
- ASR collapse on dirty clips → confidence-gated dual pass; per-word confidence rendered in the UI.
- Deadpan/sarcastic drivers → low-confidence state shown honestly; never forced to a label.
- Single-clip outliers → absorbed by Kalman measurement noise; alerts need sustained evidence + lap corroboration.
- Small-N baselines early in a session → wide P₀, band shows the honesty.

**Likely questions → answers:**
- *"Would a real team use this?"* → Beachhead is driver academies/juniors (least-known drivers, most career pressure, zero tooling); the ledger answers a driver-evaluation question teams currently settle by opinion.
- *"Why not biometrics/heart rate?"* → Biosensors are regulated, invasive, and drivers resist them; radio already exists in every car and every fleet truck. Zero new hardware.
- *"Latency?"* → Per-clip pipeline ≤2 s on GPU (~4–6 s CPU); clips arrive minutes apart — real-time by a wide margin.
- *"Accuracy numbers?"* → Honest answer: no labelled F1 ground truth exists; that's exactly why the design leans on relative baselines, multi-signal agreement, and displayed uncertainty rather than claimed accuracy. (Saying this unprompted earns more than any number.)
- *"What's next?"* → Live session ingestion, endurance racing (multi-hour stints, fatigue is THE problem), fleet safety pilot.

### F5. Day-of checklist
☐ `OFFLINE=1` full run-through ×2 on the demo laptop ☐ hero clips play with sound at venue volume ☐ mic sequence tested on venue laptop mic + backup video on desktop ☐ `DEMO_PROFILE=1` on ☐ judge cards printed (two scripts) ☐ appendix slide loaded ☐ repo README final ☐ one teammate owns the keyboard, one talks, one watches judges ☐ battery + charger + HDMI adapter ☐ feature freeze respected — nothing merges after rehearsal 2.

---

## PART G — EXECUTION PLAN

### G1. Phases (gates are law: Phase N demos before N+1 starts)
| Phase | Hours | Deliverable | Gate |
|---|---|---|---|
| 0 Skeleton | 2–3 | Repo, docker-compose, FastAPI hello, Next shell + tokens, **contracts frozen** | Both run; `/api/sessions` hardcoded JSON renders in front |
| 1 Vertical slice | 4–6 | One hardcoded clip through full pipeline → ClipScore in DB | `curl /api/.../clips` shows a real Ocon ClipScore |
| 2 Real data + naive | 4–6 | OpenF1+FastF1 loaders, SSE batch processing, baselines, EWMA, threshold alerts | Qatar 2023 loads → full scores + trace + ≥1 alert |
| 3 Radio Rewind v1 | 6–8 | Charts, markers, clip panel, scrubber, toasts (naive trace) | **Minimum shippable** — centrepiece works on cached data |
| 4 Bayesian engine | 5–7 | kalman.py + bocpd.py + unit tests + live toggle | Toggle flips traces; tests pass; band renders |
| 5 Garage/Debrief/Cockpit | 5–6 | Driver cards, Wrapped, Ledger, mic flow | Mic works on the actual demo laptop |
| 6 Polish + freeze | 4 | Motion pass, offline bundle, README, rehearsal ×2, hero clips locked | Runs twice, WiFi off. **Freeze.** |

**Team split (3):** A: pipeline+data (1–2) → engine (4). B: frontend throughout (0,3,5,6). C: data curation/bench, Debrief+Cockpit, deck & pitch (floats).

### G2. Setup (Phase 0)
```bash
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" faster-whisper funasr librosa soundfile \
            transformers torch numpy pandas fastf1 requests sqlite-utils sse-starlette
sudo apt install ffmpeg
npx create-next-app@latest frontend --ts --tailwind --app
cd frontend && npm i framer-motion wavesurfer.js @visx/visx html-to-image
```

### G3. README skeleton (Phase 6 — judges read READMEs)
Title + one-liner → GIF of Radio Rewind → Why (3 sentences: Qatar/Ocon, the gap, the fix) → architecture diagram → "The hard part" (Kalman+BOCPD, 5 sentences + rocket line) → HF model table → run (`docker compose up`, `OFFLINE=1`) → what's next (live ingestion, endurance, fleets).

### G4. Risk register
| Risk | Mitigation |
|---|---|
| Brutal radio audio | dual gated ASR · hero clips pre-benched · noisy clips reframed as the ATC-model justification |
| Acted-speech model bias | relative z-scores · 3-signal fusion · honest "uncertain" state · say it before asked |
| Venue WiFi death | committed offline bundle · `OFFLINE=1` rehearsed |
| Engine misbehaves at 2 a.m. | naive engine same API · one-flag swap |
| Mic demo flops | DEMO_PROFILE thresholds · venue-mic test · backup video |
| Scope creep | phase gates + Phase-6 freeze are law |

*End of document. Build Phase 0.*
