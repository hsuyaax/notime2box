"""Variable-Δt Kalman filter over hidden driver state x = [A, V, Ȧ, V̇].

Radio clips are sparse, irregular, noisy measurements of a continuous hidden state.
Process noise integrates over the gap, so uncertainty GROWS during radio silence and
snaps tight when a clip lands — the UI's confidence band is literally the covariance.
Pure numpy on purpose: the point is that we did the thinking.
"""
import numpy as np

from ..contracts import TracePoint
from .base import StateEngine
from .bocpd import BOCPD
from .alerts import detect_alerts

Q_SCALE = 2e-4          # process noise per second — how fast a mind can drift unseen
BASE_R = 0.02           # measurement noise for a perfectly trusted channel
T_UNIT = 60.0           # Δt normalisation (minutes) so Q stays well-conditioned


class Kalman:
    def __init__(self, x0: np.ndarray, p0_diag=(0.09, 0.09, 0.01, 0.01)):
        self.x = x0.astype(float)                     # [A, V, dA, dV]
        self.P = np.diag(p0_diag).astype(float)

    def predict(self, dt_s: float) -> None:
        dt = max(dt_s, 1e-3) / T_UNIT
        F = np.eye(4)
        F[0, 2] = F[1, 3] = dt
        # G maps white accel noise into state; Q = q·GGᵀ integrates over the gap
        G = np.array([[dt * dt / 2, 0], [0, dt * dt / 2], [dt, 0], [0, dt]])
        Q = Q_SCALE * dt * (G @ G.T) + Q_SCALE * dt * np.diag([1, 1, 0.1, 0.1])
        self.x = F @ self.x
        self.P = F @ self.P @ F.T + Q

    def update(self, z: np.ndarray, H: np.ndarray, R: np.ndarray) -> None:
        y = z - H @ self.x
        S = H @ self.P @ H.T + R
        K = self.P @ H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ H) @ self.P
        self.x[:2] = np.clip(self.x[:2], 0.0, 1.0)


def clip_measurement(c: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Stack up to 3 channels: acoustic [A,V], prosody→A, text→V. Dynamic per-channel trust."""
    rows, zs, rs = [], [], []
    conf = max(c.get("asr_conf", 0.0), 0.05)
    agree = 0.7 if c.get("signals_agree") else 1.3

    # acoustic (audeering) — always present
    rows += [[1, 0, 0, 0], [0, 1, 0, 0]]
    zs += [c["arousal"], c["valence"]]
    r_ac = BASE_R * agree / max(c.get("confidence", 0.5), 0.1)
    rs += [r_ac, r_ac]

    # prosody → arousal proxy (speech rate normalised around ~4 sps)
    pr = c.get("prosody", {})
    if pr.get("rate_sps", 0) > 0:
        rows.append([1, 0, 0, 0])
        zs.append(float(np.clip(pr["rate_sps"] / 8.0, 0, 1)))
        rs.append(BASE_R * 3 * agree)

    # text emotion → valence proxy (needs a usable transcript)
    te = c.get("text_emotion", {})
    if te and conf > 0.3:
        neg = te.get("anger", 0) + te.get("fear", 0) + te.get("sadness", 0)
        pos = te.get("joy", 0) + te.get("neutral", 0)
        rows.append([0, 1, 0, 0])
        zs.append(float(np.clip(0.5 + 0.5 * (pos - neg), 0, 1)))
        rs.append(BASE_R * 2 * agree / conf)

    return np.array(zs), np.array(rows, dtype=float), np.diag(rs)


class BayesEngine(StateEngine):
    name = "bayes"

    def score_session(self, clips, laps):
        if not clips:
            return [], []
        # init from driver baseline: first ~20% of clips
        n0 = max(1, len(clips) // 5)
        a0 = float(np.mean([c["arousal"] for c in clips[:n0]]))
        v0 = float(np.mean([c["valence"] for c in clips[:n0]]))
        kf = Kalman(np.array([a0, v0, 0.0, 0.0]))
        bocpd = BOCPD()

        trace: list[TracePoint] = []
        clip_points: list[TracePoint] = []
        t_prev = clips[0]["t_session_s"]
        regime = 0
        for i, c in enumerate(clips):
            # dense predicted points across the silence gap: the band breathing on
            # screen IS the covariance growing — no frontend interpolation fakery
            gap = c["t_session_s"] - t_prev
            n_steps = min(int(gap // 30), 20)
            if n_steps > 1 and trace:
                import copy
                sim = copy.deepcopy(kf)
                for s in range(1, n_steps):
                    sim.predict(gap / n_steps)
                    trace.append(TracePoint(
                        t=round(t_prev + gap * s / n_steps, 1),
                        mean=[float(sim.x[0]), float(sim.x[1])],
                        std=[float(np.sqrt(sim.P[0, 0])), float(np.sqrt(sim.P[1, 1]))],
                        p_change=0.0, regime_id=regime))
            kf.predict(gap)
            z, H, R = clip_measurement(c)
            kf.update(z, H, R)
            p_change, run_len = bocpd.step(kf.x[0])
            if i < 3:
                p_change = 0.0          # BOCPD startup transient, not a regime shift
            if p_change > 0.5 and run_len < 3:
                regime += 1
            tp = TracePoint(
                t=c["t_session_s"],
                mean=[float(kf.x[0]), float(kf.x[1])],
                std=[float(np.sqrt(kf.P[0, 0])), float(np.sqrt(kf.P[1, 1]))],
                p_change=float(p_change), regime_id=regime)
            trace.append(tp)
            clip_points.append(tp)
            t_prev = c["t_session_s"]
        # alerts use the sparse clip-aligned trace; the dense one is for the UI band
        alerts = detect_alerts(clips, clip_points, laps)
        return trace, alerts
