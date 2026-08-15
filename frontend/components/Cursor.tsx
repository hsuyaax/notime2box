"use client";
// Custom cursor: small dot, expands into a labelled ring over [data-cursor] elements.
// Cut first if performance is tight — never touch the confidence band instead.
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/lib/smoothScroll";

const LABELS: Record<string, string> = {
  play: "PLAY", drag: "DRAG", select: "SELECT", menu: "MENU", download: "SAVE",
};

export default function Cursor() {
  const [label, setLabel] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const reduced = useReducedMotion();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 400, damping: 35 });
  const sy = useSpring(y, { stiffness: 400, damping: 35 });

  useEffect(() => {
    if (matchMedia("(pointer: coarse)").matches) { setTouch(true); return; }
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as HTMLElement)?.closest?.("[data-cursor]");
      setLabel(el ? LABELS[el.getAttribute("data-cursor") ?? ""] ?? null : null);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  if (touch || reduced) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 z-[60] pointer-events-none flex items-center justify-center rounded-full border border-race-red mix-blend-difference"
      style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
      animate={{ width: label ? 64 : 8, height: label ? 64 : 8, backgroundColor: label ? "transparent" : "var(--red)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {label && <span className="font-mono text-[9px] tracking-widest text-race-white">{label}</span>}
    </motion.div>
  );
}
