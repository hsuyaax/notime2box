"""SQLite storage + hash-keyed JSON cache. Every pipeline stage is idempotent through here."""
import hashlib
import json
import sqlite3
from pathlib import Path
from . import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, meta TEXT);
CREATE TABLE IF NOT EXISTS clips (clip_id TEXT PRIMARY KEY, session_key TEXT, score TEXT);
CREATE TABLE IF NOT EXISTS laps (session_key TEXT, lap INTEGER, data TEXT,
                                 PRIMARY KEY (session_key, lap));
CREATE TABLE IF NOT EXISTS baselines (key TEXT PRIMARY KEY, stats TEXT);
"""


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.executescript(_SCHEMA)
    return conn


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def cache_get(stage: str, key: str):
    p = config.CACHE_DIR / f"{stage}_{key}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def cache_put(stage: str, key: str, value) -> None:
    p = config.CACHE_DIR / f"{stage}_{key}.json"
    p.write_text(json.dumps(value), encoding="utf-8")


def save_session(key: str, meta: dict) -> None:
    with db() as c:
        c.execute("INSERT OR REPLACE INTO sessions VALUES (?,?)", (key, json.dumps(meta)))


def get_sessions() -> list[dict]:
    with db() as c:
        return [json.loads(m) for (m,) in c.execute("SELECT meta FROM sessions")]


def delete_clips(session_key: str) -> None:
    with db() as c:
        c.execute("DELETE FROM clips WHERE session_key=?", (session_key,))


def save_clip(session_key: str, score: dict) -> None:
    with db() as c:
        c.execute("INSERT OR REPLACE INTO clips VALUES (?,?,?)",
                  (score["clip_id"], session_key, json.dumps(score)))


def get_clips(session_key: str) -> list[dict]:
    with db() as c:
        rows = c.execute("SELECT score FROM clips WHERE session_key=?", (session_key,))
        clips = [json.loads(s) for (s,) in rows]
    return sorted(clips, key=lambda x: x["t_session_s"])


def save_laps(session_key: str, laps: list[dict]) -> None:
    with db() as c:
        c.executemany("INSERT OR REPLACE INTO laps VALUES (?,?,?)",
                      [(session_key, l["lap"], json.dumps(l)) for l in laps])


def get_laps(session_key: str) -> list[dict]:
    with db() as c:
        rows = c.execute("SELECT data FROM laps WHERE session_key=? ORDER BY lap", (session_key,))
        return [json.loads(d) for (d,) in rows]


def save_baseline(key: str, stats: dict) -> None:
    with db() as c:
        c.execute("INSERT OR REPLACE INTO baselines VALUES (?,?)", (key, json.dumps(stats)))


def get_baseline(key: str):
    with db() as c:
        row = c.execute("SELECT stats FROM baselines WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else None
