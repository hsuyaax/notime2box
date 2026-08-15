"""Acoustic emotion: audeering (continuous A/V/D) + emotion2vec+ (categorical).

Falls back to prosody-derived estimates when models are unavailable — clearly
flagged so a stubbed score never silently impersonates a model output.
"""
import numpy as np

from .. import registry

SR = 16000


def dimensional(samples: np.ndarray, prosody: dict) -> dict:
    """→ {arousal, valence, dominance, source}. audeering outputs A/V/D ∈ [0,1].

    Uses our explicit architecture (pipeline/audeering_model.py), NOT the stock
    audio-classification pipeline — the latter silently loads a random regression
    head for this checkpoint and emits near-constant values. See that module.
    """
    model = registry.emotion_dim()
    if model is not None:
        try:
            r = model(samples, SR)
            return {"arousal": round(r["arousal"], 3),
                    "valence": round(r["valence"], 3),
                    "dominance": round(r["dominance"], 3),
                    "source": "audeering"}
        except Exception as e:
            print(f"[emotion] dim model failed: {e}")
    # heuristic: fast + loud + high pitch variance ⇒ aroused
    a = np.clip(0.3 + prosody.get("rate_sps", 0) / 12 + min(prosody.get("f0_var", 0), 2000) / 6000, 0, 1)
    return {"arousal": round(float(a), 3), "valence": 0.5, "source": "heuristic"}


def categorical(samples: np.ndarray) -> dict:
    """→ {label: prob} from emotion2vec+, or {} if unavailable."""
    model = registry.emotion_cat()
    if model is None:
        return {}
    try:
        res = model.generate(samples, granularity="utterance", extract_embedding=False)
        labels = [l.split("/")[-1].lower() for l in res[0]["labels"]]
        return {l: round(float(s), 3) for l, s in zip(labels, res[0]["scores"])}
    except Exception as e:
        print(f"[emotion] cat model failed: {e}")
        return {}
