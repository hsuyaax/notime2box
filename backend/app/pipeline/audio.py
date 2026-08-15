"""Audio normalisation + VAD trim. ffmpeg loudnorm → 16 kHz mono wav → speech-only."""
import subprocess
import wave
from pathlib import Path

import numpy as np

from .. import config, registry

SR = 16000


def normalise(src: Path) -> Path:
    """ffmpeg loudnorm to 16 kHz mono wav, cached beside the source."""
    out = config.CACHE_DIR / f"norm_{src.stem}.wav"
    if out.exists():
        return out
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-af", "loudnorm", "-ar", str(SR), "-ac", "1",
         str(out)], check=True, capture_output=True)
    return out


def load_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0


def vad_trim(samples: np.ndarray) -> np.ndarray:
    """Silero VAD if available, else energy-gate fallback (drops beeps/static tails)."""
    v = registry.vad()
    if v is not None:
        try:
            import torch
            model, utils = v
            get_speech_timestamps = utils[0]
            ts = get_speech_timestamps(torch.from_numpy(samples), model, sampling_rate=SR)
            if ts:
                return np.concatenate([samples[t["start"]:t["end"]] for t in ts])
        except Exception:
            pass
    # ponytail: energy-gate fallback, replace tuning if it ever eats quiet speech
    frame = SR // 50
    n = len(samples) // frame
    frames = samples[: n * frame].reshape(n, frame)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    gate = max(rms.max() * 0.08, 0.005)
    keep = rms > gate
    if not keep.any():
        return samples
    return frames[keep].ravel()


def prepare(src: Path) -> tuple[np.ndarray, float]:
    """Full prep: returns (speech samples @16k mono, original duration seconds)."""
    wav = normalise(src)
    samples = load_wav(wav)
    dur = len(samples) / SR
    return vad_trim(samples), dur
