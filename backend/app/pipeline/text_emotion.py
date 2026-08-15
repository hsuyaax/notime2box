"""Text emotion on the transcript — the linguistic vote when the audio is filthy."""
from .. import registry

# tiny lexicon fallback so the text channel never fully disappears
_NEG = {"gone", "no", "grip", "box", "broken", "lost", "can't", "cant", "why",
        "always", "never", "stupid", "unbelievable", "slow", "tyres", "dying"}
_ANGER = {"why", "always", "never", "stupid", "unbelievable", "told", "hell", "damn"}


def analyse(transcript: str) -> dict:
    if not transcript.strip():
        return {}
    model = registry.text_emotion()
    if model is not None:
        try:
            out = model(transcript[:512])[0]
            return {o["label"].lower(): round(float(o["score"]), 3) for o in out}
        except Exception as e:
            print(f"[text_emotion] model failed: {e}")
    words = {w.strip(".,!?").lower() for w in transcript.split()}
    neg = len(words & _NEG) / max(len(words), 1)
    anger = len(words & _ANGER) / max(len(words), 1)
    return {"anger": round(min(anger * 3, 1.0), 3), "sadness": round(min(neg, 1.0), 3),
            "neutral": round(max(1 - neg * 2 - anger * 2, 0.0), 3)}
