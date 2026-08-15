"""Bayesian Online Changepoint Detection (Adams & MacKay 2007).

Normal-Inverse-Gamma conjugate likelihood (Student-t predictive, implemented inline —
no scipy) on the Kalman arousal mean; constant hazard 1/λ; run-length posterior
truncated at 50 and renormalised for bounded memory. Emits p_change(t) = p(r_t=0).
"""
import math
import numpy as np

MAX_RUN = 50


def _student_t_logpdf(x: float, df: float, loc: float, scale: float) -> float:
    z = (x - loc) / scale
    return (math.lgamma((df + 1) / 2) - math.lgamma(df / 2)
            - 0.5 * math.log(df * math.pi) - math.log(scale)
            - (df + 1) / 2 * math.log1p(z * z / df))


class BOCPD:
    def __init__(self, hazard_lambda: float | None = None,
                 mu0=0.5, kappa0=1.0, alpha0=1.0, beta0=0.01):
        from .. import config
        lam = hazard_lambda if hazard_lambda is not None else config.BOCPD_HAZARD
        self.h = 1.0 / lam
        self.prior = (mu0, kappa0, alpha0, beta0)
        self.r = np.array([1.0])                       # p(r_0 = 0) = 1
        self.params = [self.prior]                     # NIG params per run length

    def _pred_logpdf(self, x: float) -> np.ndarray:
        out = np.empty(len(self.params))
        for i, (mu, kappa, alpha, beta) in enumerate(self.params):
            scale = math.sqrt(beta * (kappa + 1) / (alpha * kappa))
            out[i] = _student_t_logpdf(x, 2 * alpha, mu, scale)
        return out

    @staticmethod
    def _posterior(params: tuple, x: float) -> tuple:
        mu, kappa, alpha, beta = params
        return ((kappa * mu + x) / (kappa + 1), kappa + 1, alpha + 0.5,
                beta + kappa * (x - mu) ** 2 / (2 * (kappa + 1)))

    def step(self, x: float) -> tuple[float, int]:
        """Observe x; return (p_change, argmax run length).

        Note: p(r_t=0|x_1:t) is exactly the hazard by construction, so the usable
        change signal is the posterior mass on SHORT run lengths — it collapses onto
        the newborn run within a step or two of a real changepoint.
        """
        pred = np.exp(self._pred_logpdf(x))
        growth = self.r * pred * (1 - self.h)
        cp = float(np.sum(self.r * pred * self.h))
        r_new = np.concatenate(([cp], growth))
        r_new /= max(r_new.sum(), 1e-300)

        self.params = [self.prior] + [self._posterior(p, x) for p in self.params]
        if len(r_new) > MAX_RUN:
            r_new = r_new[:MAX_RUN]
            r_new /= r_new.sum()
            self.params = self.params[:MAX_RUN]
        self.r = r_new
        p_short = float(self.r[:3].sum())
        steady = 1 - (1 - self.h) ** 3          # baseline short-run mass at equilibrium
        p_change = max(0.0, (p_short - steady) / (1 - steady))
        return p_change, int(np.argmax(self.r))
