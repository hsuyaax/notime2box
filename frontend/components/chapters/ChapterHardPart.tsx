"use client";
// INTERLUDE — THE HARD PART. The engine is the differentiator, and until now it was
// invisible: judges saw a red line and had to take the maths on faith. This chapter
// makes it legible — the pipeline that produced the numbers, and an interactive
// predict/update loop showing uncertainty growing through silence and collapsing on
// evidence. Everything shown is the real model's behaviour, not an illustration.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import MaskedHeading from "@/components/MaskedHeading";
import { useReducedMotion } from "@/lib/smoothScroll";

const STAGES = [
  { n: "01", name: "VAD TRIM", sub: "silero-vad", note: "drops beeps + static before anything sees it" },
  { n: "02", name: "ASR", sub: "distil-whisper-v3.5 → ATC fallback", note: "second pass only when confidence < 0.55" },
  { n: "03", name: "ACOUSTIC", sub: "audeering wav2vec2", note: "arousal / valence / dominance, continuous" },
  { n: "04", name: "CATEGORICAL", sub: "emotion2vec+ large", note: "discrete emotion vote" },
  { n: "05", name: "PROSODY", sub: "numpy f0 + rate", note: "speech rate, pauses, pitch variance" },
  { n: "06", name: "LINGUISTIC", sub: "distilroberta", note: "what the words say, when audio is filthy" },
];

/** Live Kalman toy: same OU dynamics as the backend, so the curve behaves honestly. */
function PredictUpdateDemo() {
  const [mu, setMu] = useState(0.5);
  const [sigma, setSigma] = useState(0.12);
  const [history, setHistory] = useState<{ mu: number; s: number }[]>([{ mu: 0.5, s: 0.12 }]);
  const reduced = useReducedMotion();

  // mirrors the backend: saturation σ is the driver's own baseline spread
  const TAU = 900, SIG_INF = 0.12, R = 0.02;

  const silence = (dt = 420) => {
    const phi = Math.exp(-dt / TAU);
    const p = phi * phi * sigma * sigma + SIG_INF * SIG_INF * (1 - phi * phi);
    const m = mu * phi + (1 - phi) * 0.5;
    setMu(m); setSigma(Math.sqrt(p));
    setHistory((h) => [...h.slice(-22), { mu: m, s: Math.sqrt(p) }]);
  };

  const clip = () => {
    const z = 0.35 + Math.random() * 0.4;
    const p = sigma * sigma;
    const k = p / (p + R);
    const m = mu + k * (z - mu);
    const pn = (1 - k) * p;
    setMu(m); setSigma(Math.sqrt(pn));
    setHistory((h) => [...h.slice(-22), { mu: m, s: Math.sqrt(pn) }]);
  };

  const reset = () => { setMu(0.5); setSigma(0.12); setHistory([{ mu: 0.5, s: 0.12 }]); };

  const W = 560, H = 150;
  const xAt = (i: number) => (i / Math.max(history.length - 1, 1)) * (W - 20) + 10;
  const yAt = (v: number) => H - 12 - Math.max(0, Math.min(1, v)) * (H - 30);
  const band = history.map((p, i) => `${xAt(i)},${yAt(p.mu + 1.5 * p.s)}`)
    .concat([...history].reverse().map((p, i) => `${xAt(history.length - 1 - i)},${yAt(p.mu - 1.5 * p.s)}`))
    .join(" L");

  return (
    <div className="cut p-5">
      <p className="font-mono text-[10px] text-dim tracking-widest">
        PREDICT / UPDATE — REAL DYNAMICS, YOUR INPUT
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3">
        <path d={`M${band} Z`} fill="var(--red)" opacity={0.16} />
        <path d={history.map((p, i) => `${i ? "L" : "M"}${xAt(i)},${yAt(p.mu)}`).join(" ")}
          fill="none" stroke="var(--red)" strokeWidth={2} />
        {history.map((p, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(p.mu)} r={1.8} fill="var(--white)" opacity={0.55} />
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={() => silence()} data-cursor="select"
          className="cut px-3 py-2 font-mono text-[10px] text-race-white hover:text-amber">
          + 7 MIN SILENCE
        </button>
        <button onClick={clip} data-cursor="select"
          className="cut px-3 py-2 font-mono text-[10px] bg-race-red text-race-white">
          RADIO CLIP ARRIVES
        </button>
        <button onClick={reset} className="font-mono text-[10px] text-dim hover:text-race-white underline underline-offset-4">
          reset
        </button>
        <span className="font-mono text-[10px] text-dim ml-auto">
          σ = <span className="text-race-white">{sigma.toFixed(3)}</span>
          <span className="text-dim"> / saturates at {SIG_INF.toFixed(3)}</span>
        </span>
      </div>
      <p className="font-mono text-[10px] text-dim mt-3 leading-relaxed">
        Silence widens the band toward that driver&apos;s own prior and stops there — arousal
        is bounded and mean-reverting, so we model it as Ornstein-Uhlenbeck rather than a
        random walk, and saturate at the driver&apos;s baseline spread rather than a fixed
        constant. A naive constant-velocity filter diverges instead: ours reported σ≈197
        on a [0,1] quantity after an hour of silence, until we caught it.
      </p>
    </div>
  );
}

export default function ChapterHardPart() {
  return (
    <section id="ch-hardpart" className="min-h-screen px-6 py-24 max-w-7xl mx-auto w-full">
      <p className="font-mono text-xs text-dim tracking-widest">THE HARD PART</p>
      <MaskedHeading as="h2" className="display text-4xl md:text-6xl mt-2"
        lines={["WE TRACK THE MIND", "LIKE A ROCKET"]} />
      <p className="text-race-white/70 mt-5 max-w-2xl">
        Radio clips are sparse, irregular, noisy measurements of a state that exists every
        second. Per-clip classification throws that structure away. So we estimate the
        hidden state instead — and treat uncertainty as a product feature, not a footnote.
      </p>

      <div className="grid lg:grid-cols-2 gap-6 mt-12 items-start">
        <div>
          <p className="font-mono text-[10px] text-dim tracking-widest mb-3">
            SIX STAGES PER CLIP · FIVE HUGGING FACE MODELS
          </p>
          <div className="flex flex-col">
            {STAGES.map((s, i) => (
              <motion.div key={s.n}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-8%" }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
                className="flex items-baseline gap-4 py-3 border-t border-line group"
              >
                <span className="font-mono text-[10px] text-race-red w-6">{s.n}</span>
                <div className="flex-1">
                  <p className="display text-lg group-hover:text-race-red transition-colors">{s.name}</p>
                  <p className="font-mono text-[10px] text-dim mt-0.5">{s.sub}</p>
                </div>
                <p className="font-mono text-[10px] text-dim max-w-[13rem] text-right hidden md:block">{s.note}</p>
              </motion.div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-dim mt-4 leading-relaxed border-t border-line pt-4">
            Each channel enters the filter with its own measurement noise: R scales with ASR
            confidence and cross-signal agreement, so a clean clip pulls the estimate hard and
            a filthy one barely moves it. Three weak votes beat one confident guess.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <PredictUpdateDemo />
          <div className="cut p-5">
            <p className="font-mono text-[10px] text-dim tracking-widest">CHANGEPOINTS · BOCPD</p>
            <p className="text-sm text-race-white/80 mt-3 leading-relaxed">
              Adams &amp; MacKay run-length posterior over the observation stream, hazard 1/8,
              Normal-Inverse-Gamma conjugate updates, truncated at 50 runs for bounded memory.
              It answers a different question from the filter: not <em>where is he now</em>,
              but <em>did the process itself just change</em>.
            </p>
            <p className="font-mono text-[10px] text-dim mt-4 leading-relaxed">
              Detection runs on measurements, not the smoothed posterior — feeding it the
              filter output erased the very discontinuity it exists to find, and it went
              silent on every real session until we caught that.
            </p>
          </div>
          <div className="cut p-5">
            <p className="font-mono text-[10px] text-dim tracking-widest">WHAT WE DON&apos;T CLAIM</p>
            <p className="text-sm text-race-white/80 mt-3 leading-relaxed">
              There is no labelled ground truth for F1 driver stress, so we report no accuracy
              figure. That absence is the reason the design leans on per-driver baselines,
              multi-signal agreement and visible uncertainty instead of a number we can&apos;t defend.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
