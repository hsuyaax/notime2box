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

**Wait for the backend to finish loading models before you open the browser.** It
warms all six at startup, which takes a minute or two. Confirm with:

```bash
curl http://localhost:8000/health
# {"ready": true, "mic_scoring": "real models"}
```

If `ready` is false the mic will be slow on its first use. Wait for true.

Then, in the browser you'll present from:
1. Open `http://localhost:3000`, **hard-refresh (Ctrl+Shift+R)**.
2. Scroll the whole page once, top to bottom. This warms every GSAP pin and
   decodes the background video, so nothing stutters when it matters.
3. Scroll back to the top.
4. Click the mic button once and **accept the permission prompt now** — never
   let a browser permission dialog appear mid-demo.
5. Zoom to 90% (Ctrl+-) so Radio Rewind fits without scrolling.

Radio Rewind **auto-loads NOR 2024 Lusail** (19 clips), so the charts are populated
before you touch anything. You can still pick any other session in the Garage.

**Three cards in the picker are empty — do not click them on camera:**
`2024 JEDDAH — VER`, `2024 JEDDAH — RIC`, `2024 ZANDVOORT — SAI`. They are listed
but have zero processed clips, so the rail comes up blank and the charts 404. Every
other session works.

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

`Scroll to THE GARAGE. Let them see the grid. Hover one card — the driver goes
from grey to full colour.`

> *"This is real data. Fifteen processed sessions, 179 radio clips, real team radio
> from OpenF1, real lap times from FastF1, all through five Hugging Face models."*

`Point at 2024 MELBOURNE — SAI and its "7 DRIVER" figure.` **Use this card — it is
the cleanest separation in the set: 18 clips, 7 driver, 11 engineer, 0 unknown.**

> *"Notice this number. Team radio carries both sides of the conversation and labels
> neither. Eighteen clips here, only seven are actually the driver — the other eleven
> are his race engineer. If you score the engineer's voice as the driver's emotional
> state, everything downstream is wrong. So we separate them first."*

> *"Across the whole corpus it's 26 driver clips out of 179. Most of what sounds like
> driver radio isn't."*

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

`Point at effect size −0.21 against the 0.8 threshold, and the lap delta −0.02s.`

> *"Two independent tests have to pass before we call fatigue. The voice test wants an
> effect size of 0.8 across the race — Russell's is minus 0.21, so his voice didn't
> decline at all, it drifted slightly the other way. And his lap times are flat, two
> hundredths. Both tests fail, so the system raises nothing."*

> *"That's true of every session here. Zero fatigue alerts across all fifteen. We ran
> the test, we show you the number, and we refuse to call it. A voice-only system
> tuned to fire would have cried wolf fifteen times."*

`Scroll to THE HARD PART → the "MEASURED, NOT ASSUMED" table.`

> *"We assumed three signals — voice, rhythm, words — would corroborate each other.
> We measured it. They don't. Acoustic arousal and speech rate correlate at
> minus 0.3 — the opposite of the assumption we built on."*

**If a judge reads the `n=32` on that table and asks:** it's the figure from when we
froze that panel; the corpus has since grown to 179 clips and acoustic↔rate is now
−0.30 on n=168. Say that — the sign and the size held as the data grew, which is the
better story anyway. Don't pretend the table is live.

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
2023–2025 race and driver, click LOAD.`
The race and driver menus are **fully cached** — all 71 races, 1098 drivers — so the
dropdowns populate with the network unplugged. Pressing LOAD on a session we have not
processed does need the network to fetch its audio; if the venue WiFi is dead, let
them pick from the seventeen already loaded instead.

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

**"That alert clip is labelled UNKNOWN, not DRIVER — so why did you score it?"**
→ *"Deliberate. We only exclude clips we're confident are the engineer. Unknown stays
in, because on a twelve-clip session dropping everything we can't name would throw
away most of the race on a guess. The label tells you our confidence; it doesn't
silently delete data."* (`speaker.driver_clips()` is literally `!= "engineer"`.)

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
| Stuck on SCORING | Models still loading. Check `curl localhost:8000/health` for `ready: true`. The request now times out after 45s with a message rather than hanging. |
| Backend 404s | Restart uvicorn; `OFFLINE=1` |
| Live race load fails | Venue WiFi. Menus still populate (cached); only fetching new audio needs the network. Fall back to a pre-loaded session — say *"that one pulls audio live from OpenF1"* |
| Driver menu says NO DRIVER LIST CACHED | OpenF1 has no driver data for that race. Pick another. |
| Video stutters | It's 31MB; not fatal, just scroll on |
| Scroll stops partway down the page | Lenis cached the page height before the charts rendered. **Nudge the browser window edge to resize it by a pixel** — that forces a re-measure and scrolling immediately goes all the way. `End` / `Page Down` also bypass it. |
| Clip rail empty + charts 404 | You clicked one of the three empty sessions (Jeddah VER, Jeddah RIC, Zandvoort SAI). Pick another. |

---

## DON'T

- Don't claim an accuracy percentage.
- Don't claim Fatigue Drift fires on the demo data — it deliberately doesn't.
- Don't say "AI detects stress." Say *"we estimate a hidden state with explicit
  uncertainty."* Every technical judge in the room will notice the difference.
- Don't skip Beat 4. The measured-correlation table is the most credible thing
  you have, precisely because it undercuts your own premise.
