"use client";
// Giant chapter numeral that sweeps horizontally as you scroll past the boundary
// (spec D: "chapter transitions sweep the big chapter numeral across the screen").
//
// It sits behind the content at very low opacity and is aria-hidden — it's texture
// and wayfinding, not information. Scroll-linked rather than time-linked, so it
// tracks the reader instead of playing at them; with reduced-motion it renders
// statically rather than disappearing, so the composition survives.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/smoothScroll";

export default function ChapterMarker({ n, label }: { n: string; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !wrapRef.current || !numRef.current) return;
    const tween = gsap.fromTo(
      numRef.current,
      { xPercent: 12 },
      {
        xPercent: -60,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      }
    );
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced]);

  return (
    <div ref={wrapRef} aria-hidden
      className="relative w-full h-[22vh] min-h-[120px] overflow-hidden pointer-events-none select-none">
      {/* only the numeral sweeps; the caption stays anchored to the content margin
          so the pair doesn't drift apart as the number travels */}
      <span ref={numRef}
        className="absolute left-0 top-1/2 -translate-y-1/2 num-speed text-[24vw] leading-[0.75] text-race-white/[0.05] whitespace-nowrap">
        {n}
      </span>
      <span className="absolute left-6 bottom-4 font-mono text-[10px] tracking-[0.4em] text-dim/40">
        {label}
      </span>
      <span className="absolute left-6 right-6 bottom-0 h-px bg-line/60" />
    </div>
  );
}
