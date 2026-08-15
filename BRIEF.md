# THE SILENT CO-DRIVER — ONE-PAGE BRIEF

**F1 regulates the thermometer. We monitor the human.**

## The problem
Qatar 2023: a driver vomited in his helmet on lap 15 and raced 40 more laps before the pit wall found out. Others retired dehydrated or reported near-blackouts. Every one of them was talking on the radio the entire race — their voices degrading lap by lap — while engineers watched sector times. Telemetry instruments the car; nobody instruments the human. Drivers won't self-report (careers punish weakness), but strain leaks into the voice involuntarily. That's the signal we decode.

## The solution
The Silent Co-Driver ingests real F1 team radio (OpenF1) and lap data (FastF1), transcribes it, reads stress and fatigue from the voice, and tracks the driver's **hidden mental state across the whole race** — warning the pit wall *before* lap times fall apart.

**Core pipeline (five Hugging Face models, our orchestration):** VAD trim (pyannote) → confidence-gated dual ASR (distil-whisper-large-v3.5, falling back to an ATC-finetuned Whisper built for compressed radio) → emotion2vec+ (categorical) ∥ audeering wav2vec2 (continuous arousal/valence) ∥ librosa prosody ∥ text-emotion on the transcript → fused, confidence-scored clip result.

**The hard part:** radio clips are sparse, irregular, noisy measurements of a hidden continuous state — so we track the driver's mind the way NASA tracks a rocket: a **variable-Δt Kalman filter** fusing three signal channels with dynamic per-clip trust, plus **Bayesian Online Changepoint Detection** to catch regime shifts. Uncertainty is a first-class output: the UI's confidence band visibly widens during radio silence and snaps tight when a clip lands.

**Alerts that decide, not describe:**
- **Fatigue Drift** — fires only when a sustained state regime change coincides with lap-time degradation.
- **Red Mist** — frustration spike → "cool-down call recommended" (direct penalty-point mitigation for a rookie one incident from a race ban).
All alerts ship with their evidence (z-scores, speech-rate delta, lap delta) — explainable by construction. Every score is a **z-score against that driver's own baseline**, because Räikkönen's flat is normal and Norris's animated is calm.

## Why it matters to this team
The Qatar driver now drives for the organising team. The team principal — an ex-race engineer — is publicly unable to separate driver performance from an inconsistent car for his 2027 decision. Our **Season Ledger** (cross-race state trends + weekend debriefs) is the missing objective data channel for exactly that call; the **Composure Curve** does the same for rookie development. Built lean, for the team that has always won by leverage instead of headcount — and the same architecture extends to trucking fleets, endurance racing, and industrial dispatch.

## The demo
Pick any 2023–25 race → the timeline populates from real radio. Scrub the cinematic **Radio Rewind** screen: emotion-tinted waveforms, per-word transcript confidence, the confidence band breathing with the math, alerts firing as race-control cards. Then a judge speaks into the mic — calm take captures *their* baseline, angry take triggers Red Mist live against it. Runs fully offline; naive engine ships behind the same API as the Bayesian one, so the demo can never be held hostage by ambition.

**Stack:** Next.js + Tailwind + Framer Motion + wavesurfer + visx · FastAPI + numpy engine · SQLite + hash-keyed cache · Docker · `OFFLINE=1`.
