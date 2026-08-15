"use client";
// Site-wide background video, fixed behind every chapter.
//
// One element in the root layout, not one per section: the file is loaded and
// decoded once and every chapter shares it. A per-chapter <video> would download
// and decode the same asset repeatedly.
//
// Legibility is the whole problem with full-bleed video behind body copy, so the
// video is held well back — low opacity plus a heavy scrim — and the design's own
// palette stays in front. Drops out entirely under prefers-reduced-motion, and if
// the file is missing (it is gitignored, so a fresh clone has no video) the site
// falls back to the canvas ambient field with nothing broken.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/smoothScroll";

export default function VideoField() {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || failed) return;
    const v = videoRef.current;
    if (!v) return;
    const start = setTimeout(() => v.play().catch(() => {}), 400);

    // stop decoding while the tab is hidden — a looping 1080p background is the
    // easiest thing in the app to leave burning CPU in a background tab
    const onVis = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(start); document.removeEventListener("visibilitychange", onVis); };
  }, [reduced, failed]);

  if (reduced || failed) return null;

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-[0.28] saturate-[0.55]"
        muted loop playsInline preload="auto"
        onError={() => setFailed(true)}
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      {/* scrim: without this, body copy over moving footage is unreadable */}
      <div className="absolute inset-0 bg-bg/72" />
      {/* vignette keeps the edges dark so panels and text keep their contrast */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(10,10,10,0.85) 100%)" }} />
    </div>
  );
}
