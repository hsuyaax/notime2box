"use client";
// Site-wide ambient background.
//
// The page was reading flat: a single dark value behind every chapter, so nothing
// suggested depth or motion between the hero and the footer. This sits behind
// everything at very low contrast and gives the whole site a living ground without
// touching legibility or the two-colour palette.
//
// Three layers, all cheap:
//   1. a slow drifting radial "sheen" that follows scroll position
//   2. a faint telemetry grid that parallaxes
//   3. an animated signal trace — the product's own motif, at ~4% opacity
//
// Canvas rather than video: it weighs nothing, never blocks paint, carries no
// licensing risk, and stays inside the palette. Honours prefers-reduced-motion by
// rendering one static frame instead of disappearing.
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/smoothScroll";

export default function AmbientField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      // scroll progress drives the sheen so the ground shifts as you read
      const doc = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const p = Math.min(Math.max(window.scrollY / doc, 0), 1);

      ctx.clearRect(0, 0, w, h);

      // 1. drifting sheen
      const cx = w * (0.25 + 0.5 * Math.sin(t * 0.08 + p * 3));
      const cy = h * (0.3 + 0.4 * p);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
      g.addColorStop(0, "rgba(230,0,43,0.055)");
      g.addColorStop(0.45, "rgba(230,0,43,0.015)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 2. telemetry grid, parallaxed
      ctx.strokeStyle = "rgba(244,244,244,0.028)";
      ctx.lineWidth = 1;
      const step = 96 * dpr;
      const off = (p * step * 6) % step;
      ctx.beginPath();
      for (let x = -off; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = -off; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      // 3. the product's own motif: a slow signal trace across the middle
      ctx.beginPath();
      const mid = h * 0.5;
      for (let x = 0; x <= w; x += 8 * dpr) {
        const k = x / w;
        const y = mid
          + Math.sin(k * 7 + t * 0.5) * h * 0.10
          + Math.sin(k * 17 - t * 0.3) * h * 0.035;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(230,0,43,0.05)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      if (!reduced) {
        t += 0.004;
        raf = requestAnimationFrame(draw);
      }
    };

    draw();
    const onScroll = () => { if (reduced) draw(); };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
