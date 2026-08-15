"""Engine unit tests — these are also a Q&A exhibit (FINAL-SOLUTION C2/C3)."""
import numpy as np
import pytest

from backend.app.engine.kalman import Kalman, BayesEngine, clip_measurement
from backend.app.engine.bocpd import BOCPD
from backend.app.engine.naive import NaiveEngine
from backend.app.engine.alerts import detect_alerts, _red_mist


def make_clip(t, arousal, valence=0.5, z=0.0, lap=None, **kw):
    c = {"clip_id": f"c{t}", "t_session_s": t, "lap": lap, "arousal": arousal,
         "valence": valence, "arousal_z": z, "valence_z": 0.0, "confidence": 0.8,
         "asr_conf": 0.8, "signals_agree": True, "cat_emotion": {},
         "prosody": {"rate_sps": 4.0, "pause_ratio": 0.2, "f0_var": 500},
         "text_emotion": {"neutral": 0.8}, "label": "calm"}
    c.update(kw)
    return c


def test_silence_grows_variance():
    """Uncertainty must grow back toward the prior once evidence stops arriving.

    Starts from a post-update (tight) posterior, because P now *starts* at the
    driver's prior — silence returns it there rather than pushing past it.
    """
    kf = Kalman(np.array([0.5, 0.5, 0, 0]), sigma_inf=0.12)
    z, H, R = clip_measurement(make_clip(0.0, 0.5))
    kf.update(z, H, R)
    v0 = kf.P[0, 0]
    kf.predict(60);  v1 = kf.P[0, 0]
    kf.predict(300); v2 = kf.P[0, 0]
    assert v1 > v0 and v2 > v1, "variance must grow during radio silence"
    assert v2 <= kf.sigma_inf ** 2 + 1e-9, "and must never exceed the driver's prior"


def test_update_shrinks_variance():
    kf = Kalman(np.array([0.5, 0.5, 0, 0]), sigma_inf=0.12)
    kf.predict(120)
    prior = kf.P[0, 0]
    z, H, R = clip_measurement(make_clip(120, 0.7))
    kf.update(z, H, R)
    assert kf.P[0, 0] < prior, "high-confidence clip must shrink posterior variance"


def test_kalman_follows_regime_shift():
    clips = [make_clip(t * 60.0, 0.3 if t < 10 else 0.8) for t in range(20)]
    trace, _ = BayesEngine().score_session(clips, [])
    at_clip = {tp.t: tp for tp in trace}
    assert trace[-1].mean[0] > 0.65, "trace must follow a sustained shift within k steps"
    assert at_clip[300.0].mean[0] < 0.45


def test_bocpd_spikes_at_step_change():
    rng = np.random.default_rng(0)
    xs = list(0.3 + 0.02 * rng.standard_normal(25)) + list(0.8 + 0.02 * rng.standard_normal(25))
    b = BOCPD(hazard_lambda=8)
    ps = [b.step(x)[0] for x in xs]
    assert max(ps[24:29]) > 0.8, "P(change) must spike at the step"
    assert max(ps[5:24]) < 0.5 and max(ps[32:]) < 0.5, "and nowhere else"


def test_red_mist_fires():
    clips = [make_clip(10.0, 0.9, valence=0.1, z=2.2, lap=5,
                       cat_emotion={"angry": 0.6},
                       prosody={"rate_sps": 5.5, "pause_ratio": 0.1, "f0_var": 900},
                       text_emotion={"anger": 0.7})]
    alerts = detect_alerts(clips, NaiveEngine().score_session(clips, [])[0], [])
    assert any(a.type == "red_mist" for a in alerts)
    assert alerts[0].evidence["arousal_z"] == 2.2


def test_fatigue_drift_needs_lap_corroboration():
    clips = [make_clip(t * 60.0, 0.2, z=-1.5, lap=t + 1) for t in range(6)]
    trace, _ = NaiveEngine().score_session(clips, [])
    # laps flat → no alert
    flat = [{"lap": i + 1, "lap_time_s": 90.0, "t_start_s": i * 90.0, "is_pit": False}
            for i in range(20)]
    assert not [a for a in detect_alerts(clips, trace, flat) if a.type == "fatigue_drift"]
    # laps degrading in the drift window (rest of the race clean) → alert
    slow = [{"lap": i + 1,
             "lap_time_s": 90.0 + (0.6 if i < 6 else 0.0),
             "t_start_s": i * 90.0, "is_pit": False} for i in range(20)]
    fired = [a for a in detect_alerts(clips, trace, slow) if a.type == "fatigue_drift"]
    assert fired and fired[0].evidence["lap_delta_s"] >= 0.25


def test_engines_share_interface():
    clips = [make_clip(t * 60.0, 0.5) for t in range(5)]
    for eng in (NaiveEngine(), BayesEngine()):
        trace, alerts = eng.score_session(clips, [])
        assert len(trace) >= 5 and isinstance(alerts, list)


# --- regression guards for two modelling bugs found on real data ---

def test_variance_saturates_instead_of_diverging():
    """A constant-velocity model made variance grow as Δt⁵ — an hour of silence
    reported σ≈197 for a quantity bounded in [0,1]. OU dynamics must saturate."""
    for gap in (60, 900, 3600, 36000):
        kf = Kalman(np.array([0.5, 0.5, 0.0, 0.0]), sigma_inf=0.12)
        kf.predict(gap)
        sd = np.sqrt(kf.P[0, 0])
        assert sd < 0.6, f"variance diverging at {gap}s: sigma={sd:.2f}"
    # and it must still GROW with silence, just boundedly
    a = Kalman(np.array([0.5, 0.5, 0.0, 0.0]), sigma_inf=0.12)
    b = Kalman(np.array([0.5, 0.5, 0.0, 0.0]), sigma_inf=0.12)
    z, H, R = clip_measurement(make_clip(0.0, 0.5))
    a.update(z, H, R); b.update(z, H, R)
    a.predict(30); b.predict(600)
    assert np.sqrt(b.P[0, 0]) > np.sqrt(a.P[0, 0])


def test_bocpd_sees_jump_in_observations_not_smoothed_posterior():
    """BOCPD must run on observations. Fed the Kalman posterior it was silent on
    every real session, because smoothing erases the discontinuity it looks for."""
    flat = [make_clip(t * 60.0, 0.50) for t in range(8)]
    jump = flat + [make_clip((8 + t) * 60.0, 0.85) for t in range(6)]
    _, _ = BayesEngine().score_session(flat, [])
    tr_flat, _ = BayesEngine().score_session(flat, [])
    tr_jump, _ = BayesEngine().score_session(jump, [])
    assert max(p.p_change for p in tr_jump) > max(p.p_change for p in tr_flat), \
        "a real step change must score higher than a flat session"
    assert len({p.regime_id for p in tr_jump}) > 1, "step change should open a new regime"


def test_red_mist_fires_on_slow_deliberate_anger():
    """Anger is not always fast speech.

    Locks in a real case: Russell, Qatar 2023 lap 4, "Come on, what the hell?
    Come on." — emotion2vec+ scored angry 1.00 and the text model 0.83, but the
    delivery is slow and clipped (1.75 syl/s). A mandatory speech-rate gate vetoed
    the clearest true positive in the whole dataset, which is also what the measured
    arousal/rate correlation (-0.33) predicts. Rate now scales confidence instead.
    """
    slow_angry = make_clip(240.0, 0.80, valence=0.2, z=1.56, lap=4,
                           cat_emotion={"angry": 1.0},
                           prosody={"rate_sps": 1.75, "pause_ratio": 0.3, "f0_var": 400},
                           text_emotion={"anger": 0.83})
    fired = [a for a in _red_mist([slow_angry]) if a.type == "red_mist"]
    assert fired, "slow, deliberate anger must still raise Red Mist"
    assert fired[0].evidence["anger_acoustic"] == 1.0

    # ...and a high-arousal POSITIVE clip must not (excited != angry)
    happy = make_clip(300.0, 0.85, valence=0.9, z=2.2, lap=10,
                      cat_emotion={"happy": 0.9},
                      prosody={"rate_sps": 5.5, "pause_ratio": 0.1, "f0_var": 900},
                      text_emotion={"joy": 0.8})
    assert not _red_mist([happy]), "celebration must never trigger a cool-down call"
