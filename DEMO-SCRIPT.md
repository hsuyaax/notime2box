# THE SILENT CO-DRIVER — DEMO SCRIPT

**Total: ~5 minutes.** Everything below is verified working on the current build.
Lines in *italics* are what you say. `Actions` are what you click.

---

## BEFORE YOU START (2 min, do it offstage)

```bash
# terminal 1 — backend
cd notime2box
$env:ENGINE="bayes"; $env:OFFLINE="1"
.venv312\Scripts\python -m uvicorn backend.app.main:app --port 8000

# terminal 2 — frontend
cd notime2box\frontend
npm run build ; npm start
```

Then, in the browser you'll present from:
1. Open `http://localhost:3000`, **hard-refresh (Ctrl+Shift+R)**.
2. Scroll the whole page once, top to bottom. This warms every GSAP pin and
   decodes the background video, so nothing stutters when it matters.
3. Scroll back to the top.
4. Click the mic button once and **accept the permission prompt now** — never
   let a browser permission dialog appear mid-demo.
5. Zoom to 90% (Ctrl+-) so Radio Rewind fits without scrolling.

`OFFLINE=1` means **no network is used**. You can demo with WiFi off.

---

## BEAT 1 — THE COLD OPEN (45s)

`Land on the hero. Don't scroll yet. Let the video and waveform run for 2 seconds.`

> *"Qatar, 2023. Lap 15, Esteban Ocon vomits inside his helmet. He races 40 more
> laps. The pit wall finds out afterwards."*

`Scroll slowly through the three pinned statements.`

> *"Every one of those drivers was on the radio all race. Their voices were
> degrading lap by lap. Every pit wall was watching sector times instead."*

> *"Formula 1 instruments the car to the millimetre. Nobody instruments the human."*

---

## BEAT 2 — THE GARAGE (30s)

`Scroll to THE GARAGE. Let them see the grid of sessions.`

> *"This is real data. Fifteen sessions, real team radio from OpenF1, real lap
> times from FastF1, all processed through five Hugging Face models."*

`Point at a card's "13 DRIVER" figure.`

> *"And notice this number. Team radio carries both sides of the conversation and
> labels neither. Nineteen clips, only thirteen are actually the driver. The rest
> is his race engineer — and if you score the engineer's voice as the driver's
> emotional state, everything downstream is wrong. We separate them."*

`Click 2023 LUSAIL — RUS.`

---

## BEAT 3 — RADIO REWIND, THE CENTREPIECE (90s)

`Wait for the charts. Three lanes, top to bottom.`

> *"Lap times on top. Below, the driver's hidden state. Bottom lane, changepoint
> probability."*

**Point at the red band.**

> *"That band is not decoration — it's the covariance of a Kalman filter. Watch it
> widen when the radio goes quiet, and snap tight the moment a clip lands. When we
> don't know, the product says so."*

**`Flip the engine toggle NAIVE → BAYESIAN.`**

> *"Same data, two engines. The naive one is z-scores and a moving average. The
> Bayesian one estimates a hidden state with variable time steps."*

**Scroll down to the clip rail. Find the lap 4 card — it says STRESSED, z +1.34.**

> *"'Come on, what the hell? Come on.' The acoustic model scored that anger 1.0.
> The text model, independently, 0.83. That fired a Red Mist alert — a
> cool-down-call recommendation."*

**Point at an ENGINEER · NOT SCORED card.**

> *"And that one is his engineer. We don't give it a state label at all."*

---

## BEAT 4 — THE HONEST BIT (45s) ← *your strongest 45 seconds*

`Scroll to the SESSION ASSESSMENT panel on the right.`

> *"Here's the part I actually want to show you. This is the fatigue test."*

`Point at effect size 0.67 / 0.8 and lap delta.`

> *"Russell declined more than any driver in our dataset — his voice measurably
> drops across the race. But over the same window his lap times got 0.8 seconds
> FASTER. So the system refuses to raise a fatigue alert."*

> *"A voice-only system would have cried wolf there. Ours needs the car to agree."*

`Scroll to THE HARD PART → the "MEASURED, NOT ASSUMED" table.`

> *"We assumed three signals — voice, rhythm, words — would corroborate each other.
> We measured it. They don't. Acoustic arousal and speech rate correlate at
> minus 0.33 — the opposite of the assumption we built on."*

> *"That's on the site, not buried. It changed the product: our anger rule used to
> require fast speech, and it was vetoing the clearest angry clip we had, because
> that driver was angry slowly."*

---

## BEAT 5 — TRY THE COCKPIT (60s) ← *the moment they remember*

`Scroll to TRY THE COCKPIT. Hand the laptop or invite a judge over.`

> *"Take one. Read that line, calm."*

`They read: "Understood, box this lap, box box." → tap REC → it auto-stops at 5s.`

> *"That just captured YOUR baseline. Not a generic one — yours, thirty seconds ago."*

`Click TAKE 2. Card changes.`

> *"Now the same person, angry."*

`They read the meltdown line → REC.`

> *"That z-score is against their own baseline. Which is the entire point —
> Räikkönen's flat is normal, Norris's animated is calm. Absolute thresholds are
> wrong in this domain."*

---

## BEAT 6 — CLOSE (30s)

> *"Two alerts. One you just triggered yourself. The other, by design, you can't —
> because fatigue is a regime, not a moment."*

> *"No labelled ground truth exists for F1 driver stress, so we claim no accuracy
> number. That's exactly why this leans on per-driver baselines, visible
> uncertainty, and lap-time corroboration instead."*

> *"Smallest team on the grid has always won by leverage, not headcount. Same
> architecture works for trucking fleets, dispatch, air traffic — any job with a
> voice-only channel and a human who won't admit they're struggling."*

---

## Q&A — HAVE THESE READY

**"Does this only work on your one example?"**
→ *Best answer you have.* `Scroll to the Garage picker, let THEM choose any
2023–2025 race and driver, click LOAD.` It runs live. (Needs WiFi — if the venue
network is dead, say so and offer it after.)

**"How accurate is it?"**
→ *"There is no labelled ground truth for F1 driver stress, so I won't quote you a
number I can't defend. That absence is why the design leans on relative baselines,
multi-signal agreement and displayed uncertainty."* Saying this unprompted lands
better than any figure.

**"Isn't the emotion model trained on acted speech?"**
→ *"Yes — which is why every score is a z-score against that driver's own baseline,
never an absolute threshold."*

**"What was hard?"**
→ *"The emotion model looked like it was working and wasn't. It declares a custom
head that the standard loader silently replaces with a random one — inference still
returns plausible numbers. Arousal spread across sixteen real clips was 0.003. A
constant. Everything downstream was dead and nothing errored. We only caught it by
checking the distribution."*

**"Why not heart-rate / biometrics?"**
→ *"Regulated, invasive, and drivers resist them. Radio already exists in every car
and every truck. Zero new hardware."*

---

## IF SOMETHING BREAKS

| Symptom | Do this |
|---|---|
| Page looks stale / old layout | Ctrl+Shift+R |
| Charts empty | You didn't pick a session — go to Garage |
| Mic does nothing | Permission wasn't granted; reload, click REC, accept |
| Backend 404s | Restart uvicorn; `OFFLINE=1` |
| Live race load fails | Venue WiFi. Fall back to a pre-loaded session — say *"that one pulls live from OpenF1, which needs the network"* |
| Video stutters | It's 31MB; not fatal, just scroll on |

---

## DON'T

- Don't claim an accuracy percentage.
- Don't claim Fatigue Drift fires on the demo data — it deliberately doesn't.
- Don't say "AI detects stress." Say *"we estimate a hidden state with explicit
  uncertainty."* Every technical judge in the room will notice the difference.
- Don't skip Beat 4. The measured-correlation table is the most credible thing
  you have, precisely because it undercuts your own premise.
