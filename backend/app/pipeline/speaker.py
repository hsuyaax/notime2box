"""Separate the DRIVER from his RACE ENGINEER within a session.

Why this exists
---------------
OpenF1's `team_radio` is a single stream per driver number: it contains both sides of
the conversation and labels neither. So "Nice job, Max. You have delivered on that."
is filed under Verstappen and was being scored as *his* emotional state — when it is
his engineer speaking. Measured on our corpus, a large minority of clips are the
engineer, and several of the highest-arousal clips in the whole dataset are engineer
speech. Every driver baseline, z-score and alert threshold was contaminated by it.

The product claims to read the driver's voice. This makes that true.

Method — semi-supervised label propagation
------------------------------------------
1. LEXICAL seeds. Engineers address the driver by FIRST name almost every call
   ("Lando, box this lap", "So George, we're looking at P4") and relay strategy;
   drivers speak in the first person about themselves and the car. This is the
   reliable signal, so it labels what it can confidently.
   (First names matter: an earlier version matched the OpenF1 acronym "NOR" against
   transcripts that say "Lando", so the strongest cue never fired and the cluster
   labels came out inverted.)
2. ACOUSTIC propagation. Mean-pooled wav2vec2 hidden states act as a voice
   fingerprint — we already compute this inside the emotion model and were throwing
   it away. Cluster the session in two, then let each cluster inherit the majority
   label of its confidently-seeded members, which extends the labels to clips that
   carry no lexical cue at all.

A cluster with no seeds, or an even split, stays "unknown" and is kept rather than
guessed at — we never silently drop data we aren't sure about.
"""
import re

import numpy as np

# Engineer-side markers: addressing the driver, relaying strategy/position/status.
ENGINEER_PAT = re.compile(
    r"\b(box box|box this lap|mate\b|well done|good job|nice job|copy that|"
    r"we're looking at|currently p\d|that's p\d|gap (to|behind|ahead)|"
    r"target|delta|push now|stay out|we are checking|understood, we|"
    r"tyres are good|strat \d|mode \w+|drs|safety car deployed)\b", re.I)

# Driver-side markers: first-person report of own state or the car's behaviour.
DRIVER_PAT = re.compile(
    r"\b(i (can't|cannot|feel|felt|think|need|have no|don't|didn't|am|was)|"
    r"my (tyres|brakes|engine|helmet|drink|hands|neck)|"
    r"i'm (struggling|dying|losing|pushing|ok|okay|fine)|"
    r"no grip|understeer|oversteer|something's wrong|check the|can we)\b", re.I)


def _name_variants(full_name: str, acronym: str) -> list[str]:
    """Name forms an engineer might use. The FIRST name is the important one —
    engineers say "Lando", not "NOR"."""
    out: list[str] = []
    parts = [p for p in re.split(r"\s+", full_name or "") if p]
    if parts:
        first, last = parts[0], parts[-1]
        if len(first) > 2:
            out.append(re.escape(first))
        if len(last) > 2:
            out.append(re.escape(last.capitalize()))
    if acronym and len(acronym) >= 3:
        out.append(re.escape(acronym))
    return out


def _lexical_score(text: str, name_res: list[str]) -> int:
    """+ve ⇒ looks like the engineer, -ve ⇒ looks like the driver."""
    s = 0
    if ENGINEER_PAT.search(text):
        s += 1
    if DRIVER_PAT.search(text):
        s -= 1
    # An engineer addresses the driver by name; a driver rarely says his own.
    if name_res and re.search(r"\b(" + "|".join(name_res) + r")\b", text, re.I):
        s += 2
    return s


def _kmeans2(x: np.ndarray, iters: int = 25, seed: int = 0) -> np.ndarray:
    """Tiny 2-means. Avoids a scikit-learn dependency for ~20 points."""
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), 2, replace=False)]
    labels = np.zeros(len(x), dtype=int)
    for _ in range(iters):
        d = ((x[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        new = d.argmin(1)
        if (new == labels).all():
            break
        labels = new
        for k in (0, 1):
            if (labels == k).any():
                c[k] = x[labels == k].mean(0)
    return labels


def assign_speakers(clips: list[dict], embeddings: dict[str, np.ndarray],
                    driver_acronym: str, driver_full_name: str = "") -> list[dict]:
    """Tag every clip with speaker = driver | engineer | unknown (in place)."""
    if not clips:
        return clips

    names = _name_variants(driver_full_name, driver_acronym)
    lex = {c["clip_id"]: _lexical_score(c.get("transcript", ""), names) for c in clips}
    seed = {cid: ("engineer" if v > 0 else "driver" if v < 0 else None)
            for cid, v in lex.items()}

    usable = [c for c in clips if c["clip_id"] in embeddings]
    if len(usable) >= 6:
        x = np.stack([embeddings[c["clip_id"]] for c in usable])
        x = (x - x.mean(0)) / (x.std(0) + 1e-6)      # standardise before clustering
        labels = _kmeans2(x)

        # Each cluster inherits the majority label of its confidently seeded members.
        vote: dict[int, int] = {0: 0, 1: 0}
        for c, l in zip(usable, labels):
            s = seed[c["clip_id"]]
            if s == "engineer":
                vote[l] += 1
            elif s == "driver":
                vote[l] -= 1
        cluster_label = {
            k: ("engineer" if vote[k] > 0 else "driver" if vote[k] < 0 else None)
            for k in (0, 1)
        }
        # If both clusters vote the same way the split carries no speaker information.
        if cluster_label[0] is not None and cluster_label[0] == cluster_label[1]:
            cluster_label = {0: None, 1: None}

        by_id = {c["clip_id"]: l for c, l in zip(usable, labels)}
        for c in clips:
            cid = c["clip_id"]
            propagated = cluster_label.get(by_id[cid]) if cid in by_id else None
            # a direct lexical hit always outranks an inherited cluster label
            c["speaker"] = seed[cid] or propagated or "unknown"
        return clips

    for c in clips:
        c["speaker"] = seed[c["clip_id"]] or "unknown"
    return clips


def driver_clips(clips: list[dict]) -> list[dict]:
    """Clips usable for driver-state estimation. 'unknown' is kept — excluding it
    would throw away most of a small session on a guess."""
    return [c for c in clips if c.get("speaker") != "engineer"]
