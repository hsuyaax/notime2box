"use client";
// Lenis smooth scroll wired into the GSAP ticker. Respects prefers-reduced-motion —
// falls back to native scroll and skips Lenis entirely.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export const ReducedMotionContext = createContext(false);
export const useReducedMotion = () => useContext(ReducedMotionContext);

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [reduced, setReduced] = useState(false);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return; // native scroll, no Lenis, ScrollTrigger still works off native scroll
    const l = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    setLenis(l);
    l.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => {
      l.raf(time);
      rafId.current = requestAnimationFrame(raf);
    };
    rafId.current = requestAnimationFrame(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      cancelAnimationFrame(rafId.current);
      l.destroy();
      setLenis(null);
    };
  }, [reduced]);

  return (
    <ReducedMotionContext.Provider value={reduced}>
      <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
    </ReducedMotionContext.Provider>
  );
}
