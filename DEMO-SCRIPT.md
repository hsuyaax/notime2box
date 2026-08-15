# THE SILENT CO-DRIVER — DEMO SCRIPT

**~5:20.** Follows the page in its real order, top to bottom, with no backtracking.
Every number below was read out of the running backend, and every click was tested.

Lines in *italics* are what you say. `Actions` are what you do.

---

## BEFORE YOU START (offstage)

```bash
# terminal 1 — backend
cd notime2box
$env:ENGINE="bayes"; $env:OFFLINE="1"
.venv312\Scripts\python -m uvicorn backend.app.main:app --port 8000

# terminal 2 — frontend
cd notime2box\frontend
npm run build ; npm start
```

**Wait for the models before opening the browser.** All six warm at startup (a minute
or two). Confirm:

```bash
curl http://localhost:8000/health
# {"ready": true, "mic_scoring": "real models"}
```

If `ready` is false the mic will be slow on first use. Wait for `true`.

Then:
1. Open `http://localhost:3000`, **hard-refresh (Ctrl+Shift+R)**.
2. **Scroll the whole page top to bottom once.** This warms every GSAP pin, decodes the
   background video, and triggers the Debrief counters so they animate cleanly later.
3. Scroll back to the top.
4. Click the mic once and **accept the permission prompt now**. Never let a browser
   permission dialog appear mid-demo.
5. Zoom to 90% (Ctrl+-) so Radio Rewind's three lanes fit without scrolling.

**The page auto-loads NOR 2024 Lusail**, so Radio Rewind is already populated before you
touch anything. It picks whichever session has the most scoreable driver audio.

### Three things that will bite you

| | |
|---|---|
| **Scroll stalls partway down** | Lenis cached the page height before the charts rendered. **Nudge the browser window edge by one pixel** — forces a re-measure, scrolling immediately goes all the way. `End` / `Page Down` also bypass it. Do this once after load and it stays fixed. |
| **Three dead session cards** | `2024 JEDDAH — VER`, `2024 JEDDAH — RIC`, `2024 ZANDVOORT — SAI` have zero processed clips. Blank rail, 404 charts. **Never click them on camera.** The other 15 all work. |
| **YouTube won't play offline** | The video panels are click-to-load embeds. With `OFFLINE=1` / WiFi off they will not load. **Don't click them.** Nothing else on the page needs the network. |

---

## BEAT 1 — COLD OPEN · `01 THE PROBLEM` (40s)

`Land on the hero. Don't scroll. Let the video and waveform run two seconds.`

> *"Qatar, 2023. Lap 15, Esteban Ocon vomits inside his helmet. He races 40 more laps.
> The pit wall finds out afterwards."*

`Scroll slowly through the three pinned statements.`

> *"Every one of those drivers was on the radio all race. Their voices were degrading lap
> by lap. Every pit wall was watching sector times instead."*

> *"Formula 1 instruments the car to the millimetre. Nobody instruments the human."*

`Keep scrolling past the interstitial — "It's the mind that makes the difference."`

---

## BEAT 2 — `02 THE GARAGE` (35s)

`Let them see the grid of session cards. Hover one — the driver goes grey to full colour.`

> *"This is real data. Fifteen processed sessions, 179 radio clips — real team radio from
> OpenF1, real lap times from FastF1, all through five Hugging Face models."*

`Point at any card's "N CLIPS · N DRIVER" figure.`

> *"Team radio carries both sides of the conversation and labels neither. So before we
> score anything, we separate the driver from his race engineer. That second number is
> what's left after we drop the engineer — because if you score the engineer's voice as
> the driver's emotional state, everything downstream is wrong."*

**`Click 2023 LUSAIL — RUS.`** *(card reads `12 CLIPS · 8 DRIVER`)*

> *"Twelve calls. Four are his engineer — gone. Eight go into Russell's state."*

`Radio Rewind updates immediately. Keep scrolling into it.`

---

## BEAT 3 — `03 RADIO REWIND`, THE CENTREPIECE (90s)

`Three lanes, top to bottom.`

> *"Lap times on top. Below, the driver's hidden state. Bottom lane, changepoint
> probability."*

**Point at the red band around the state line.**

> *"That band is not decoration — it's the covariance of a Kalman filter. Watch it widen
> when the radio goes quiet, and snap tight the moment a clip lands. When we don't know,
> the product says so."*

**`Flip the engine toggle BAYESIAN → NAIVE.`** *(the state and changepoint lanes visibly
collapse from a dense curve to a few flat segments — lap times correctly stay identical)*

> *"Same data, two engines. The naive one is z-scores and a moving average — eight points,
> fixed uncertainty. The Bayesian one estimates a hidden state with variable time steps —
> ninety-six points, and uncertainty that actually moves."*

**`Flip back to BAYESIAN.`**

`Scroll to the clip rail. Find the lap 4 card — STRESSED, z +1.34.`

> *"'Come on, what the hell? Come on.' The acoustic model scored that anger 1.0. The text
> model, independently, 0.83. That fired a Red Mist alert — a cool-down-call
> recommendation, confidence 0.75."*

`Point at an ENGINEER · NOT SCORED card.` *(lap 9, "Nice job, mate.")*

> *"And that one is his engineer. We don't give it a state label at all."*

---

## BEAT 4 — THE HONEST BIT (50s) ← *your strongest 50 seconds*

`Still in Radio Rewind. Scroll to the SESSION ASSESSMENT panel.`

> *"Here's the part I actually want to show you. This is the fatigue test."*

`Point at effect size −0.21 against the 0.8 threshold, and lap delta −0.02s.`

> *"Two independent tests have to pass before we call fatigue. The voice test wants an
> effect size of 0.8 across the race — Russell's is minus 0.21, so his voice didn't
> decline at all, it drifted slightly the other way. His lap times are flat, two
> hundredths. Both fail. The system raises nothing."*

> *"That's true of every session here. Zero fatigue alerts across all fifteen. We run the
> test, we show you the number, and we refuse to call it."*

`Scroll past the interstitial — "Fatigue is a regime, not a moment." — into`
**`04 THE HARD PART`** `→ the "MEASURED, NOT ASSUMED" table.`

> *"We assumed three signals — voice, rhythm, words — would corroborate each other. We
> measured it. They don't. Acoustic arousal and speech rate correlate at minus 0.3 — the
> opposite of the assumption we built on."*

> *"That's on the site, not buried. And it changed the product: our anger rule used to
> require fast speech, and it was vetoing the clearest angry clip we had, because that
> driver was angry slowly."*

**If a judge reads `n=32` on that table:** it's frozen from when we wrote the panel. The
corpus is now 179 clips and acoustic↔rate is −0.30 on n=168. Say exactly that — the sign
and the size held as the data grew, which is the better story. Don't imply it's live.

---

## BEAT 5 — `05 THE DEBRIEF` (25s) ← *the breather, let it animate*

`Scroll in and stop talking for two seconds while the counters count up.`

> *"Same race, as a debrief. Twelve radio calls. Peak stress lap 4. Composure 67 out of
> 100 — that's the volatility of his own z-scores, not a league table."*

`Point at the RACE WRAPPED card.`

> *"Calm 75%, stressed 8%, tired 17%. And the spiciest call of his race, pulled
> automatically — lap 4, z plus 1.3."*

> *"A race engineer gets this in the debrief instead of scrubbing an hour of audio."*

---

## BEAT 6 — `06 TRY THE COCKPIT` (60s) ← *the moment they remember*

`Hand the laptop over or invite a judge up.`

> *"Take one. Read that line, calm."*

`They read "Understood, box this lap, box box." → tap REC → auto-stops at 5s.`

> *"That just captured YOUR baseline. Not a generic one — yours, thirty seconds ago."*

`Click TAKE 2 · LOSE IT. The card changes.`

> *"Now the same person, angry."*

`They read the meltdown line → REC.`

> *"That z-score is against their own baseline. Which is the entire point — Räikkönen's
> flat is normal, Norris's animated is calm. Absolute thresholds are wrong in this
> domain."*

*(Scoring returns in well under a second — all six models are already warm.)*

---

## BEAT 7 — CLOSE (25s)

> *"Two alert types. One you just triggered yourself. The other, by design, you can't —
> because fatigue is a regime, not a moment."*

> *"No labelled ground truth exists for F1 driver stress, so we claim no accuracy number.
> That's exactly why this leans on per-driver baselines, visible uncertainty, and
> lap-time corroboration instead."*

> *"Smallest team on the grid has always won by leverage, not headcount. Same architecture
> works for trucking fleets, dispatch, air traffic — any job with a voice-only channel and
> a human who won't admit they're struggling."*

---

## Q&A — HAVE THESE READY

**"Does this only work on your one example?"**
→ *Best answer you have.* `Scroll to the Garage, let THEM pick any 2023–2025 race and
driver, click LOAD.` Race and driver menus are **fully cached** — 71 races, 1098 drivers —
so they populate with the network unplugged. Pressing LOAD on an unprocessed session does
need the network for its audio; if venue WiFi is dead, steer them to the 15 loaded ones.

**"What does the DRIVER number on the card actually mean?"**
→ *"Clips we'll score as the driver — everything except the ones we're confident are the
engineer. Some are confidently the driver, some we can't name. We keep the unnamed ones,
because on a twelve-clip session dropping everything we can't label throws away most of
the race on a guess. The label shows our confidence; it doesn't silently delete data."*
(`speaker.driver_clips()` is literally `!= "engineer"`.)

**"That alert clip is UNKNOWN, not DRIVER — why score it?"**
→ Same answer as above. Say it before they have to ask, if you can.

**"How accurate is it?"**
→ *"There is no labelled ground truth for F1 driver stress, so I won't quote a number I
can't defend. That absence is why the design leans on relative baselines, multi-signal
agreement and displayed uncertainty."* Saying this unprompted lands better than any figure.

**"Isn't the emotion model trained on acted speech?"**
→ *"Yes — which is why every score is a z-score against that driver's own baseline, never
an absolute threshold."*

**"What was hard?"**
→ *"The emotion model looked like it was working and wasn't. It declares a custom head
that the standard loader silently replaces with a random one — inference still returns
plausible numbers. Arousal spread across sixteen real clips was 0.003. A constant.
Everything downstream was dead and nothing errored. We only caught it by checking the
distribution."*

**"Why not heart-rate / biometrics?"**
→ *"Regulated, invasive, and drivers resist them. Radio already exists in every car and
every truck. Zero new hardware."*

---

## IF SOMETHING BREAKS

| Symptom | Do this |
|---|---|
| Scroll stops partway down | Nudge the window edge one pixel. `End` / `Page Down` also work. |
| Clip rail empty + charts 404 | You clicked one of the three empty sessions. Pick another. |
| Page looks stale | Ctrl+Shift+R |
| Charts empty | No session selected — go to the Garage |
| Mic does nothing | Permission not granted; reload, click REC, accept |
| Stuck on SCORING | Models still loading. `curl localhost:8000/health` → `ready: true`. Times out at 45s with a message rather than hanging. |
| Video panel blank | Expected offline. Don't click them. |
| Backend 404s | Restart uvicorn with `OFFLINE=1` |
| Live race load fails | Venue WiFi. Menus still populate; only new audio needs network. Fall back to a loaded session — *"that one pulls audio live from OpenF1."* |
| Driver menu says NO DRIVER LIST CACHED | OpenF1 has no driver data for that race. Pick another. |

---

## DON'T

- Don't claim an accuracy percentage.
- Don't claim Fatigue Drift fires on this data — it deliberately doesn't, in all 15.
- Don't click the three empty session cards, or any YouTube panel while offline.
- Don't say "AI detects stress." Say *"we estimate a hidden state with explicit
  uncertainty."* Every technical judge will notice the difference.
- Don't skip Beat 4. The measured-correlation table is the most credible thing you have,
  precisely because it undercuts your own premise.
