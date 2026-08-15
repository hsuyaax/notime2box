"""Seed a synthetic-but-realistic Qatar 2023 Ocon session into the DB.

Gives the frontend contract-true data on day one and guarantees OFFLINE=1 always
has a session. Real data via POST /api/sessions/{key}/load replaces it in place.
Run: python -m backend.scripts.seed_demo
"""
import random

from backend.app import store
from backend.app.contracts import ClipScore, Prosody
from backend.app.pipeline.clipscore import apply_baseline

KEY = "2023_qatar_R_OCO"
rng = random.Random(42)

# (t_min, lap, arousal, valence, rate, transcript, cat, txt)  — a race in 18 calls
SCRIPT = [
    (2,   1, .42, .60, 3.8, "okay radio check, all good",                         {"neutral": .8}, {"neutral": .9}),
    (7,   4, .45, .58, 4.0, "balance is fine, rears are okay for now",            {"neutral": .7}, {"neutral": .8}),
    (13,  7, .50, .52, 4.2, "getting some understeer in ten and twelve",          {"neutral": .6}, {"neutral": .7}),
    (19, 10, .48, .55, 4.1, "copy, keeping the delta",                            {"neutral": .8}, {"neutral": .9}),
    (26, 14, .68, .38, 4.9, "I'm not feeling good, it's so hot in here",          {"sad": .4, "neutral": .4}, {"fear": .3, "sadness": .4}),
    (29, 15, .78, .25, 5.4, "I just vomited, I'm telling you, in the helmet",     {"disgusted": .4, "sad": .3}, {"disgust": .5, "fear": .3}),
    (33, 17, .72, .30, 5.1, "okay okay I'm managing, keep me updated",            {"neutral": .5}, {"neutral": .6}),
    (41, 21, .60, .40, 4.6, "tyres starting to drop, rears mainly",               {"neutral": .6}, {"neutral": .7}),
    (48, 25, .85, .15, 5.8, "why are we ALWAYS last to react?! I told you the tyres were gone three laps ago!",
                                                                                  {"angry": .65}, {"anger": .7}),
    (52, 27, .70, .35, 5.0, "box box, confirm box",                               {"neutral": .6}, {"neutral": .8}),
    (58, 30, .52, .50, 4.2, "okay, much better on this set",                      {"happy": .3, "neutral": .6}, {"joy": .3, "neutral": .6}),
    (66, 34, .45, .48, 3.9, "copy... yeah... understood",                         {"neutral": .7}, {"neutral": .8}),
    (74, 38, .35, .45, 3.4, "I'm... struggling with the heat, drinks not working",{"sad": .5}, {"sadness": .5}),
    (80, 41, .30, .42, 3.1, "yeah... copy that",                                  {"sad": .4, "neutral": .4}, {"neutral": .6}),
    (86, 44, .27, .40, 2.9, "how many laps... how many laps left",                {"sad": .5}, {"sadness": .5, "fear": .3}),
    (92, 47, .25, .40, 2.8, "just... talk to me, keep talking to me",             {"sad": .6}, {"sadness": .6}),
    (101, 52, .38, .45, 3.5, "last five, I can do this, come on",                 {"neutral": .5}, {"neutral": .6}),
    (110, 57, .55, .70, 4.4, "P7 mate, honestly one of the hardest races of my life", {"happy": .5}, {"joy": .6}),
]


def main() -> None:
    clips = []
    for i, (t_min, lap, a, v, rate, text, cat, txt) in enumerate(SCRIPT):
        words = [(w, round(rng.uniform(.55, .97), 2)) for w in text.split()]
        clips.append(ClipScore(
            clip_id=f"{KEY}_{i:03d}", t_session_s=t_min * 60.0, lap=lap,
            duration_s=round(rng.uniform(2.5, 6.5), 1),
            transcript=text, asr_conf=round(rng.uniform(.6, .9), 2),
            asr_model="distil" if rng.random() > .3 else "atc", word_confs=words,
            arousal=a, valence=v, cat_emotion=cat,
            prosody=Prosody(rate_sps=rate, pause_ratio=round(rng.uniform(.1, .4), 2),
                            f0_var=round(300 + a * 900, 0)),
            text_emotion=txt,
        ).model_dump())

    clips = apply_baseline(clips, KEY)
    for c in clips:
        store.save_clip(KEY, c)

    # 57 laps ~92s; degradation during the late fatigue window (laps 38-50), pits 27
    laps = []
    for lap in range(1, 58):
        t = 92.0 + rng.uniform(-.4, .4) + (0.55 if 38 <= lap <= 50 else 0.0)
        laps.append({"lap": lap, "lap_time_s": round(t + (14 if lap == 27 else 0), 3),
                     "t_start_s": round((lap - 1) * 92.5, 1), "is_pit": lap == 27})
    store.save_laps(KEY, laps)
    store.save_session(KEY, {"key": KEY, "year": 2023, "gp": "qatar", "session": "R",
                             "driver": "OCO", "driver_number": 31,
                             "clip_count": len(clips), "ready": True})
    print(f"seeded {KEY}: {len(clips)} clips, {len(laps)} laps")


if __name__ == "__main__":
    main()
