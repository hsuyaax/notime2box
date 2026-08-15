"use client";
// CHAPTER 01 — THE PROBLEM. Optional dark ambient video (drop one in
// public/hero-video.mp4 — see README "Adding hero video") layered under the canvas
// waveform bleeding green→red, behind a masked-skew title reveal, then a pinned
// sequence of three statements as the viewer scrolls.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/smoothScroll";
import MaskedHeading from "@/components/MaskedHeading";

function WaveformCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      t += 0.015;
      const w = canvas.width, h = canvas.height, mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      const bars = 140;
      for (let i = 0; i < bars; i++) {
        const x = (i / bars) * w;
        const n = Math.sin(i * 0.35 + t * 2) * Math.sin(i * 0.07 - t) * 0.5 + 0.5;
        const amp = n * h * 0.38 + h * 0.02;
        // green→red bleed driven by position + time, per spec
        const bleed = Math.max(0, Math.min(1, (i / bars) * 0.6 + Math.sin(t * 0.6) * 0.4 + 0.3));
        const r = Math.round(0 + bleed * 230), g = Math.round(200 - bleed * 200), b = 40;
        ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
        ctx.fillRect(x, mid - amp / 2, w / bars - 2, amp);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-40" />;
}

const STATEMENTS = [
  <>Lap 15: a driver vomits inside his helmet.</>,
  <>He races <span className="text-race-red">40 MORE LAPS</span>.</>,
  <>The pit wall finds out afterwards.</>,
];

export default function Chapter01Hero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const statementRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !pinRef.current) return;
    const paras = statementRefs.current.filter(Boolean) as HTMLParagraphElement[];
    gsap.set(paras, { opacity: 0, y: 24 });
    gsap.set(paras[0], { opacity: 1, y: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pinRef.current, start: "top top", end: "+=200%", scrub: 0.6, pin: true,
      },
    });
    paras.forEach((p, i) => {
      if (i > 0) tl.to(paras[i - 1], { opacity: 0, y: -24, duration: 0.3 }, i)
                   .to(p, { opacity: 1, y: 0, duration: 0.3 }, i);
      else tl.to({}, { duration: 0.3 });
    });
    return () => { tl.scrollTrigger?.kill(); tl.kill(); };
  }, [reduced]);

  return (
    <div ref={rootRef} id="ch-problem">
      <section ref={heroSectionRef} className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <WaveformCanvas />
        <div className="relative z-10">
          <p className="font-mono text-xs text-dim tracking-[0.3em]">SILENT CO-DRIVER · TELEMETRY FOR THE HUMAN</p>
          <MaskedHeading
            as="h1" trigger="load" delay={0.2} stagger={0.07}
            className="display text-[13vw] mt-4"
            lines={["THE SILENT", "CO-DRIVER"]}
          />
          <p className="text-lg text-race-white/70 mt-6 max-w-xl mx-auto">Reading driver stress from radio calls.</p>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 animate-bounce">
          <span className="font-mono text-[10px] text-dim tracking-widest">SCROLL TO EXPLORE</span>
          <span className="w-px h-8 bg-line" />
        </div>
      </section>

      <div ref={pinRef} className="relative min-h-screen flex items-center justify-center px-6">
        {STATEMENTS.map((s, i) => (
          <p
            key={i}
            ref={(el) => { statementRefs.current[i] = el; }}
            className="display text-4xl sm:text-5xl md:text-7xl text-center max-w-4xl absolute left-6 right-6 mx-auto"
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  );
}
