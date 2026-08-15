"use client";
// Reusable masked skew-reveal for headings — the signature Apart/Awwwards move.
// Each word sits in an overflow-hidden mask; the word itself skews up out of the
// mask on scroll-into-view, staggered. Used on every heading in the site.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/smoothScroll";

type Props = {
  lines: string[];          // one or more lines, each split into masked words
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  delay?: number;
  stagger?: number;
  trigger?: "load" | "scroll"; // "load" plays immediately (hero), "scroll" waits for viewport
};

export default function MaskedHeading({
  lines, as: Tag = "h2", className = "", delay = 0, stagger = 0.05, trigger = "scroll",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!rootRef.current) return;
    const words = rootRef.current.querySelectorAll<HTMLElement>(".mh-word");
    if (reduced) {
      gsap.set(words, { yPercent: 0, skewY: 0, opacity: 1 });
      return;
    }
    gsap.set(words, { yPercent: 120, skewY: 7, opacity: 0 });
    const anim = {
      yPercent: 0, skewY: 0, opacity: 1, duration: 0.85, ease: "power3.out",
      stagger, delay,
    };
    const tween = trigger === "load"
      ? gsap.to(words, anim)
      : gsap.to(words, { ...anim, scrollTrigger: { trigger: rootRef.current, start: "top 85%", once: true } });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced, stagger, delay, trigger]);

  return (
    <Tag className={className}>
      <div ref={rootRef}>
        {lines.map((line, li) => (
          <div key={li} className="overflow-hidden leading-[0.95]">
            {line.split(" ").map((word, wi) => (
              <span key={wi} className="inline-block overflow-hidden pb-[0.08em] mr-[0.28em]">
                <span className="mh-word inline-block will-change-transform">{word}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </Tag>
  );
}
