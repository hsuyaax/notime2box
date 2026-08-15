"use client";
// Full-bleed quote line. Cheap to build, buys disproportionate cinema between chapters.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/smoothScroll";

export default function Interstitial({ children, mark }: { children: React.ReactNode; mark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !ref.current) return;
    const el = ref.current.querySelector(".ist-text");
    const tween = gsap.fromTo(el,
      { opacity: 0.15, filter: "blur(6px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 65%", end: "top 35%", scrub: true } });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced]);

  return (
    <section ref={ref} className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center relative">
      <p className="ist-text display text-4xl md:text-6xl max-w-4xl leading-tight">{children}</p>
      {mark && (
        <p className="font-mono text-xs text-dim tracking-[0.3em] mt-8">SCD</p>
      )}
    </section>
  );
}
