"""Tag every cached clip as driver / engineer / unknown, then rebuild baselines.

Only the wav2vec2 encoder runs here (one model, not the full five-stage pipeline),
so this is cheap to re-run over the whole corpus.

    python -m backend.scripts.separate_speakers [--dry-run]
"""
import argparse

import numpy as np

from backend.app import store
from backend.app.data import openf1
from backend.app.pipeline import audio, clipscore, speaker
from backend.app import config


def embed_session(clips: list[dict]) -> dict[str, np.ndarray]:
    """clip_id -> pooled wav2vec2 embedding (voice fingerprint)."""
    from backend.app.pipeline.audeering_model import AudeeringDimensional
    import torch

    model = AudeeringDimensional(device="cuda" if _cuda() else "cpu")
    out: dict[str, np.ndarray] = {}
    for c in clips:
        path = config.AUDIO_DIR / f"{c['clip_id']}.mp3"
        if not path.is_file():
            continue
        try:
            samples, _ = audio.prepare(path)
            x = model.processor(samples, sampling_rate=16000,
                                return_tensors="pt").input_values.to(model.device)
            with torch.no_grad():
                pooled, _ = model.model(x)
            out[c["clip_id"]] = pooled[0].float().cpu().numpy()
        except Exception as e:
            print(f"   [skip] {c['clip_id']}: {e}")
    return out


def _cuda() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False


def _full_name(meta: dict, acronym: str) -> str:
    """Engineers address drivers by first name, so we need it. Served from the
    OpenF1 catalog cache — no network needed once a session has been loaded."""
    if meta.get("driver_full_name"):
        return meta["driver_full_name"]
    try:
        sess = openf1.find_session(meta["year"], meta["gp"], "Race")
        for d in openf1.list_drivers(sess["session_key"]):
            if (d.get("acronym") or "").upper() == acronym.upper():
                return d.get("full_name") or ""
    except Exception:
        pass
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    totals = {"driver": 0, "engineer": 0, "unknown": 0}
    for meta in store.get_sessions():
        key = meta["key"]
        clips = store.get_clips(key)
        if not clips:
            continue
        drv = meta.get("driver", "")
        full = _full_name(meta, drv)
        emb = embed_session(clips)
        clips = speaker.assign_speakers(clips, emb, drv, full)

        counts = {k: sum(1 for c in clips if c["speaker"] == k) for k in totals}
        for k in totals:
            totals[k] += counts[k]
        print(f"{key:<26} driver={counts['driver']:>3} "
              f"engineer={counts['engineer']:>3} unknown={counts['unknown']:>3}")
        for c in clips:
            if c["speaker"] == "engineer":
                print(f"     [eng] {c['transcript'][:72]!r}")

        if not args.dry_run:
            # Baselines must be computed from the DRIVER's voice only — that is the
            # whole point — but every clip stays in the store so the UI can still
            # show the full conversation.
            only_driver = speaker.driver_clips(clips)
            clipscore.apply_baseline(only_driver, key)
            for c in clips:
                store.save_clip(key, c)

    print(f"\nTOTAL  driver={totals['driver']}  engineer={totals['engineer']}  "
          f"unknown={totals['unknown']}")
    if totals["engineer"]:
        share = 100 * totals["engineer"] / sum(totals.values())
        print(f"{share:.0f}% of the corpus was NOT the driver speaking.")


if __name__ == "__main__":
    main()
