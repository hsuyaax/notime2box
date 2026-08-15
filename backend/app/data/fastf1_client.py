"""FastF1 laps → LapPoint dicts. fastf1 is an optional dep; OFFLINE reads the DB."""
from .. import config, store


def get_lap_points(session_key: str, year: int, gp: str, session: str, driver: str) -> list[dict]:
    cached = store.get_laps(session_key)
    if cached or config.OFFLINE:
        return cached
    import fastf1
    fastf1.Cache.enable_cache(str(config.CACHE_DIR))
    ses = fastf1.get_session(year, gp, session)
    ses.load(telemetry=False, weather=False, messages=False)
    laps = ses.laps.pick_drivers(driver)
    t0 = ses.session_start_time
    out = []
    for _, lap in laps.iterlaps():
        lt = lap["LapTime"]
        out.append({
            "lap": int(lap["LapNumber"]),
            "lap_time_s": round(lt.total_seconds(), 3) if lt is not None and lt == lt else None,
            "t_start_s": round((lap["LapStartTime"] - t0).total_seconds(), 1)
                         if lap["LapStartTime"] == lap["LapStartTime"] else 0.0,
            "is_pit": bool(lap["PitInTime"] == lap["PitInTime"] or lap["PitOutTime"] == lap["PitOutTime"]),
        })
    store.save_laps(session_key, out)
    return out
