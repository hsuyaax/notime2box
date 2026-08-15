"""Variable-Δt Kalman filter over hidden driver state x = [A, V, Ȧ, V̇].

Radio clips are sparse, irregular, noisy measurements of a continuous hidden state.
Uncertainty GROWS across radio silence and snaps tight when a clip lands — the UI's
confidence band is literally √diag(P). Pure numpy: the point is that we did the thinking.

DYNAMICS — damped local-linear trend (Ornstein-Uhlenbeck), not a random walk.
A naive constant-velocity model is an *integrated* random walk: its variance grows as
Δt⁵, so an hour of radio silence reported σ≈197 for a quantity bounded in [0,1] —
numerically alive, physically nonsense. Driver arousal is bounded and mean-reverting:
absent evidence it decays toward the driver's own baseline, it does not wander to
infinity. So levels revert with time-constant TAU_LEVEL and velocities damp with
TAU_VEL, and the process noise is set to the exact OU form

    P ← φ²P + σ∞²(1 − φ²),      φ = e^(−Δt/τ)

which makes uncertainty *saturate* at the driver's prior instead of diverging. The
honest statement it encodes: "after long silence we know exactly what we knew before
the session — the driver's baseline — no more, no less."
"""
import numpy as np

from ..contracts import TracePoint
from .base import StateEngine
from .bocpd import BOCPD
from .alerts import detect_alerts

BASE_R = 0.02           # measurement noise for a perfectly trusted channel
TAU_LEVEL = 900.0       # s — how long a mood persists absent new evidence (~15 min)
TAU_VEL = 300.0         # s — trends decay faster than levels (~5 min)
SIGMA_INF_VEL = 0.12    # stationary σ of the trend term
SIGMA_INF_FLOOR = 0.05  # never claim more certainty than this, even on tiny sessions


class Kalman:
    def __init__(self, x0: np.ndarray, baseline: np.ndarray | None = None,
                 sigma_inf: float = 0.15):
        """sigma_inf: stationary σ the band saturates at during radio silence.

        Set it to the DRIVER'S OWN baseline spread, not a fixed constant. Absent
        evidence we fall back to exactly what we knew before the session — that
        driver's normal distribution of arousal — so uncertainty should saturate
        there and nowhere wider. A fixed 0.35 claimed more ignorance than the
        driver's entire observed range (Canada's own σ is 0.08), which is both
        physically wrong and visually swamps the trace.
        """
        self.x = x0.astype(float)                     # [A, V, dA, dV]
        self.sigma_inf = max(float(sigma_inf), SIGMA_INF_FLOOR)
        # start at the prior: before any clip we know only the baseline
        self.P = np.diag([self.sigma_inf ** 2, self.sigma_inf ** 2,
                          SIGMA_INF_VEL ** 2, SIGMA_INF_VEL ** 2]).astype(float)
        # levels revert toward this; default to the initial estimate (driver baseline)
        self.mu = (baseline if baseline is not None else x0[:2]).astype(float).copy()

    def predict(self, dt_s: float) -> None:
        dt = max(dt_s, 1e-3)
        phi_l = float(np.exp(-dt / TAU_LEVEL))        # level mean-reversion
        phi_v = float(np.exp(-dt / TAU_VEL))          # velocity damping
        # integrated contribution of an exponentially-decaying velocity over the gap
        psi = TAU_VEL * (1.0 - phi_v)

        F = np.diag([phi_l, phi_l, phi_v, phi_v])
        F[0, 2] = F[1, 3] = psi * phi_l / TAU_LEVEL   # scaled so levels stay in range
        # affine pull toward baseline (an OU has a drift term, not just a scaling)
        offset = np.concatenate([(1.0 - phi_l) * self.mu, np.zeros(2)])

        # exact OU stationary-consistent process noise → variance saturates, never diverges
        q_l = (self.sigma_inf ** 2) * (1.0 - phi_l ** 2)
        q_v = (SIGMA_INF_VEL ** 2) * (1.0 - phi_v ** 2)
        Q = np.diag([q_l, q_l, q_v, q_v])

        self.x = F @ self.x + offset
        self.P = F @ self.P @ F.T + Q

    def update(self, z: np.ndarray, H: np.ndarray, R: np.ndarray) -> None:
        y = z - H @ self.x
        S = H @ self.P @ H.T + R
        K = self.P @ H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ H) @ self.P
        self.P = 0.5 * (self.P + self.P.T)            # keep symmetric against drift
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
        # levels mean-revert toward the driver's OWN baseline, not a global constant
        # saturation σ = this driver's own arousal spread (D2: relative, never absolute)
        sig = float(np.std([c["arousal"] for c in clips])) if len(clips) > 2 else 0.12
        kf = Kalman(np.array([a0, v0, 0.0, 0.0]),
                    baseline=np.array([a0, v0]), sigma_inf=sig)
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
            # BOCPD runs on the OBSERVATION, not the Kalman posterior: the filter's job
            # is to smooth, which is precisely what erases the discontinuity changepoint
            # detection exists to find. Feeding it the smoothed mean made it silent on
            # every real session. Detect on what was measured; smooth for display.
            p_change, run_len = bocpd.step(float(c["arousal"]))
            if i < 3:
                p_change = 0.0          # BOCPD startup transient, not a regime shift
            # 0.4 on the hazard-normalised excess: calibrated against real sessions,
            # where a genuine jump (Canada, 0.54→0.83 arousal) scores ~0.49 and an
            # uneventful session never exceeds 0.02. Deliberately strict — a false
            # regime shift would fire a fatigue alert at a pit wall.
            if p_change > 0.4 and run_len < 3:
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
