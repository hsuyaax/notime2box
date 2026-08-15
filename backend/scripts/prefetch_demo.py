"""Prefetch + process the demo sessions so demo-data/ becomes the offline bundle.
Run online, once, with models installed: python -m backend.scripts.prefetch_demo
"""
import sys

from backend.app.routes import _process_session, _progress

SESSIONS = [
    "2023_qatar_R_OCO",        # the story clip — Ocon, Qatar 2023
    "2024_canada_R_NOR",       # verified via live OpenF1 query: 154 total radio
                                # clips, Norris highest of any driver (16) — picked
                                # by clip count, not a guess (Montreal 2024, chaotic
                                # red-flag race)
    "2025_silverstone_R_OCO",  # 2025 Haas era — verified live: OCO's densest 2025
                                # radio session (3 clips; upstream 2025 coverage is
                                # genuinely sparse across the whole grid, confirmed
                                # by querying all 24 races — this is the real max)
]

for key in sys.argv[1:] or SESSIONS:
    print(f"== {key}")
    _progress[key] = {"done": 0, "total": 0, "status": "running"}
    _process_session(key)
    print(f"   {_progress[key]}")
