"""Prosody features in pure numpy — rate, pauses, pitch variance. No librosa/numba.

rate_sps: voiced-onset rate as a syllables/sec proxy. pause_ratio: unvoiced fraction.
f0_var: variance of an autocorrelation pitch track over voiced frames.
"""
import numpy as np

SR = 16000
FRAME = SR // 50          # 20 ms
F0_LO, F0_HI = 70, 350    # Hz — male speech under stress stays inside this


def _frames(x: np.ndarray) -> np.ndarray:
    n = len(x) // FRAME
    return x[: n * FRAME].reshape(n, FRAME)


def _f0_autocorr(frame: np.ndarray) -> float:
    frame = frame - frame.mean()
    ac = np.correlate(frame, frame, "full")[len(frame) - 1:]
    lo, hi = SR // F0_HI, SR // F0_LO
    if hi >= len(ac):
        return 0.0
    lag = lo + int(np.argmax(ac[lo:hi]))
    return SR / lag if ac[lag] > 0.3 * ac[0] else 0.0


def analyse(samples: np.ndarray) -> dict:
    if len(samples) < FRAME * 5:
        return {"rate_sps": 0.0, "pause_ratio": 0.0, "f0_var": 0.0}
    fr = _frames(samples)
    rms = np.sqrt((fr ** 2).mean(axis=1))
    gate = max(rms.max() * 0.15, 1e-4)
    voiced = rms > gate
    dur_s = len(samples) / SR

    # onsets: unvoiced→voiced transitions ≈ syllable starts
    onsets = int(np.sum(~voiced[:-1] & voiced[1:]))
    f0s = [f for f in (_f0_autocorr(f_) for f_ in fr[voiced]) if f > 0]

    return {
        "rate_sps": round(onsets / dur_s, 2),
        "pause_ratio": round(float(np.mean(~voiced)), 3),
        "f0_var": round(float(np.var(f0s)), 1) if len(f0s) > 2 else 0.0,
    }
