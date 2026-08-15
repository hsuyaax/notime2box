"""Confidence-gated dual ASR: distil-whisper primary → ATC fine-tune fallback."""
import numpy as np

from .. import config, registry


def _run(model, samples: np.ndarray) -> tuple[str, float, list]:
    segments, _ = model.transcribe(samples, language="en", word_timestamps=True, beam_size=3)
    words, confs = [], []
    for seg in segments:
        for w in (seg.words or []):
            words.append((w.word.strip(), round(float(w.probability), 3)))
            confs.append(float(w.probability))
    text = " ".join(w for w, _ in words)
    conf = float(np.mean(confs)) if confs else 0.0
    return text, conf, words


def transcribe(samples: np.ndarray) -> dict:
    """Returns {transcript, asr_conf, asr_model, word_confs}."""
    primary = registry.asr_primary()
    if primary is None:
        return {"transcript": "", "asr_conf": 0.0, "asr_model": "none", "word_confs": []}

    text, conf, words = _run(primary, samples)
    model_used = "distil"
    if conf < config.ASR_CONF_GATE:
        atc = registry.asr_atc()
        if atc is not None:
            t2, c2, w2 = _run(atc, samples)
            if c2 > conf:
                text, conf, words, model_used = t2, c2, w2, "atc"
    return {"transcript": text, "asr_conf": round(conf, 3),
            "asr_model": model_used, "word_confs": words}
