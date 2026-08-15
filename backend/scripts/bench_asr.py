"""Rank a session's clips by ASR confidence -> lock 3-4 hero clips for live demo use.

The noisy tail becomes the "this is why the ATC fine-tune exists" talking point
(Part E.2 / F1 risk register: "brutal radio audio").

Run: python -m backend.scripts.bench_asr <session_key> [--top N]
"""
import argparse
import json

from backend.app import store


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("session_key")
    ap.add_argument("--top", type=int, default=4)
    args = ap.parse_args()

    clips = store.get_clips(args.session_key)
    if not clips:
        print(f"no clips cached for {args.session_key} — run prefetch_demo.py first")
        return

    ranked = sorted(clips, key=lambda c: c["asr_conf"], reverse=True)

    print(f"=== {args.session_key} — {len(clips)} clips, ranked by ASR confidence ===\n")
    lap = lambda c: str(c["lap"]) if c["lap"] is not None else "—"

    print(f"HERO CLIPS (top {args.top} — use these live):")
    for c in ranked[: args.top]:
        print(f"  [{c['asr_conf']:.2f}] lap {lap(c):>2} - {c['asr_model']:<6} - "
              f"\"{c['transcript'][:70]}\"")

    noisy = ranked[-args.top:]
    print(f"\nNOISY TAIL (bottom {args.top} — the ATC-fallback talking point):")
    for c in noisy:
        print(f"  [{c['asr_conf']:.2f}] lap {lap(c):>2} - {c['asr_model']:<6} - "
              f"\"{c['transcript'][:70]}\"")

    mean_conf = sum(c["asr_conf"] for c in clips) / len(clips)
    fallback_rate = sum(1 for c in clips if c["asr_model"] == "atc") / len(clips)
    print(f"\nsession mean ASR confidence: {mean_conf:.2f}")
    print(f"ATC-fallback trigger rate:   {fallback_rate:.0%}")

    out = {"session": args.session_key,
           "hero_clip_ids": [c["clip_id"] for c in ranked[: args.top]],
           "mean_asr_conf": round(mean_conf, 3),
           "atc_fallback_rate": round(fallback_rate, 3)}
    print("\n" + json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
