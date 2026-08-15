"use client";
// Fixed SCD monogram top-left. Click opens a fullscreen numbered chapter index,
// like a race menu. Selecting scrolls via Lenis and closes the overlay.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLenis } from "@/lib/smoothScroll";

const CHAPTERS = [
  { n: "01", id: "ch-problem", label: "THE PROBLEM" },
  { n: "02", id: "ch-garage", label: "THE GARAGE" },
  { n: "03", id: "ch-rewind", label: "RADIO REWIND" },
  { n: "04", id: "ch-hardpart", label: "THE HARD PART" },
  { n: "05", id: "ch-debrief", label: "THE DEBRIEF" },
  { n: "06", id: "ch-cockpit", label: "TRY THE COCKPIT" },
];

export default function ChaptersNav() {
  const [open, setOpen] = useState(false);
  const lenis = useLenis();

  const go = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.2 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-cursor="menu"
        className="fixed top-6 left-6 z-40 font-mono text-sm tracking-[0.25em] text-race-white hover:text-race-red transition-colors mix-blend-difference"
        aria-label="open chapters"
      >
        SCD
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-bg flex flex-col"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-6 right-6 font-mono text-sm tracking-[0.2em] text-dim hover:text-race-white"
            >
              CLOSE ✕
            </button>
            <nav className="m-auto flex flex-col gap-2">
              {CHAPTERS.map((c, i) => (
                <motion.button
                  key={c.id}
                  onClick={() => go(c.id)}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                  className="group flex items-baseline gap-6 text-left py-2"
                >
                  <span className="font-mono text-dim text-lg w-10">{c.n}</span>
                  <span className="display text-4xl md:text-6xl group-hover:text-race-red transition-colors">
                    {c.label}
                  </span>
                </motion.button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
