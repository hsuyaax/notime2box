"""Pre-cache the race and driver catalog for the session picker.

Why this is needed
------------------
The OpenF1 client returns [] for any uncached request when OFFLINE=1. That is the
right behaviour for a demo that must survive a dead venue network, but it meant the
"load any race" picker silently showed an empty DRIVER dropdown for every race whose
driver list had never been fetched — which was most of them. The races themselves
listed fine (that response was cached), so the failure looked arbitrary.

Run this once, online, and the whole picker works with the network unplugged:

    python -m backend.scripts.warm_catalog
"""
import time

from backend.app import config
from backend.app.data import openf1

YEARS = (2023, 2024, 2025)


def main() -> None:
    if config.OFFLINE:
        print("OFFLINE=1 — set OFFLINE=0 to warm the cache from OpenF1.")
        return

    total_races = 0
    total_drivers = 0
    for year in YEARS:
        races = openf1.list_races(year)
        print(f"{year}: {len(races)} races")
        total_races += len(races)
        for r in races:
            try:
                drivers = openf1.list_drivers(r["session_key"])
                total_drivers += len(drivers)
                print(f"   {r['country_name']:<22} {len(drivers):>2} drivers")
            except Exception as e:
                print(f"   {r['country_name']:<22} FAILED: {e}")
            time.sleep(0.25)          # be a good citizen to a free community API

    print(f"\ncached {total_races} races and {total_drivers} driver entries")
    print("the picker will now work with OFFLINE=1")


if __name__ == "__main__":
    main()
