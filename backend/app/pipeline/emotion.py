"""Acoustic emotion: audeering (continuous A/V/D) + emotion2vec+ (categorical).

Falls back to prosody-derived estimates when models are unavailable — clearly
flagged so a stubbed score never silently impersonates a model output.
"""
import numpy as np

from .. import registry

SR = 16000


def dimensional(samples: np.ndarray, prosody: dict) -> dict:
    """→ {arousal, valence, source}. audeering outputs A/V/D ∈ [0,1]."""
    model = registry.emotion_dim()
    if model is not None:
        try:
            out = model({"array": samples, "sampling_rate": SR})
            scores = {o["label"].lower(): float(o["score"]) for o in out}
            return {"arousal": round(np.clip(scores.get("arousal", 0.5), 0, 1), 3),
                    "valence": round(np.clip(scores.get("valence", 0.5), 0, 1), 3),
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
