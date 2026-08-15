"use client";
// CHAPTER 04 — THE DEBRIEF. Editorial pacing: numbers as heroes (spec D1 — a stat may
// fill a third of the viewport, numerals italicised to imply speed), then the shareable
// Wrapped card and a season ledger whose sparklines are REAL driver arousal, not
// decoration.
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SessionMeta, getSessions, getWrapped } from "@/lib/api";
import { MOCK_SESSIONS, MOCK_WRAPPED } from "@/lib/mockData";
import { useReducedMotion } from "@/lib/smoothScroll";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import MaskedHeading from "@/components/MaskedHeading";

type Wrapped = typeof MOCK_WRAPPED;

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!ref.current) return;
    if (reduced) { ref.current.textContent = to.toFixed(decimals); return; }
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: to, duration: 1.4, ease: "power3.out",
      onUpdate: () => { if (ref.current) ref.current.textContent = obj.v.toFixed(decimals); },
      scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [to, decimals, reduced]);
  return <span ref={ref}>0</span>;
}

/** Hero stat: the number is the artwork, the label is a footnote. */
function Stat({ value, label, sub, accent = false, prefix }: {
  value: number; label: string; sub?: string; accent?: boolean; prefix?: string;
}) {
  return (
    <div className="relative border-t border-line pt-5">
      {/* pb on the number: an italic display glyph at this size descends past its
          line box and collided with the label underneath */}
      <p className={`num-speed leading-[0.85] pb-3 text-[clamp(3.5rem,9vw,8rem)] ${accent ? "text-race-red" : "text-race-white"}`}>
        {prefix && <span className="text-[0.34em] align-top mr-2 not-italic tracking-[0.2em]">{prefix}</span>}
        <CountUp to={value} />
      </p>
      <p className="font-mono text-[11px] text-dim mt-3 tracking-[0.25em]">{label}</p>
      {sub && <p className="font-mono text-[10px] text-dim/70 mt-1">{sub}</p>}
    </div>
  );
}

/** Real per-session arousal trace. Flat line + "—" when a session has too little
 *  driver speech to draw anything honest. */
function Sparkline({ values, wide = false }: { values?: number[]; wide?: boolean }) {
  if (!values || values.length < 2) {
    return <span className="font-mono text-[10px] text-dim/50">—</span>;
  }
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.4);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 18 - ((v - lo) / span) * 16;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const peak = values.indexOf(hi);
  return (
    <svg viewBox="0 0 100 20" className={`${wide ? "w-full h-10" : "w-28 h-5"} inline-block align-middle overflow-visible`}>
      <line x1="0" x2="100" y1="10" y2="10" stroke="var(--line)" strokeWidth="0.5" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--red)" strokeWidth="1.4"
        vectorEffect="non-scaling-stroke" />
      <circle cx={(peak / (values.length - 1)) * 100} cy={18 - ((hi - lo) / span) * 16}
        r="1.6" fill="var(--red)" />
    </svg>
  );
}

export default function Chapter04Debrief({ session }: { session: SessionMeta | null }) {
  const [w, setW] = useState<Wrapped>(MOCK_WRAPPED);
  const [sessions, setSessions] = useState<SessionMeta[]>(MOCK_SESSIONS);
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSessions().then((s) => s.length && setSessions(s)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!session) return;
    getWrapped(session.key, session.driver).then((d) => setW({ ...MOCK_WRAPPED, ...d })).catch(() => {});
  }, [session]);

  const download = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = url;
      a.download = `race-wrapped-${session?.key ?? "demo"}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  const bars = [
    ["CALM", w.pct_calm, "var(--green)"],
    ["STRESSED", w.pct_stressed, "var(--red)"],
    ["TIRED", w.pct_tired, "var(--amber)"],
  ] as const;

  return (
    <section id="ch-debrief" className="min-h-screen px-6 py-24 max-w-7xl mx-auto w-full">
      <p className="font-mono text-xs text-dim tracking-widest">05 · THE DEBRIEF</p>
      <MaskedHeading as="h2" className="display text-3xl md:text-5xl mt-2"
        lines={["THE RACE, IN NUMBERS"]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10 mt-14">
        <Stat value={w.clip_count} label="RADIO CALLS" sub="driver + engineer, this session" />
        <Stat value={w.peak_stress_lap ?? 41} label="PEAK STRESS" prefix="LAP" accent
              sub="highest arousal vs own baseline" />
        <Stat value={w.composure ?? 71} label="COMPOSURE" sub="100 − volatility of own z-scores" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6 mt-20 items-start">
        {/* Wrapped card — 4:5 portrait, downloadable */}
        <div className="lg:col-span-2">
          <div ref={cardRef} className="cut p-7 aspect-[4/5] flex flex-col justify-between bg-panel relative overflow-hidden">
            <div className="absolute -right-6 -top-8 num-speed text-[9rem] leading-none text-race-white/[0.04] select-none">
              {w.driver}
            </div>
            <div className="relative">
              <p className="font-mono text-[10px] text-dim tracking-[0.3em]">RACE WRAPPED</p>
              <p className="display text-5xl mt-3">{w.driver}</p>
              <p className="font-mono text-xs text-dim mt-1">
                {w.session?.year} {w.session?.gp?.toUpperCase()} · {w.clip_count} CALLS
              </p>
            </div>

            {/* the session's own arousal trace — fills the card's dead middle with
                something true rather than padding */}
            {Array.isArray((w as { spark?: number[] }).spark) &&
              ((w as { spark?: number[] }).spark?.length ?? 0) > 1 && (
              <div className="relative my-4">
                <p className="font-mono text-[9px] text-dim tracking-[0.3em] mb-2">AROUSAL, START → FLAG</p>
                <Sparkline values={(w as { spark?: number[] }).spark} wide />
              </div>
            )}

            <div className="space-y-3 relative">
              {bars.map(([n, v, c]) => (
                <div key={n}>
                  <div className="flex justify-between font-mono text-[10px] tracking-widest">
                    <span className="text-dim">{n}</span><span>{v}%</span>
                  </div>
                  <div className="h-1.5 bg-line mt-1.5">
                    <div className="h-full" style={{ width: `${v}%`, background: c }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative">
              <p className="font-mono text-[10px] text-dim tracking-widest">
                SPICIEST · LAP {w.spiciest_clip?.lap ?? "—"} · z +{w.spiciest_clip?.arousal_z?.toFixed(1)}
              </p>
              <p className="text-[15px] leading-snug mt-2 text-race-white/90">
                &ldquo;{(w.spiciest_clip?.transcript ?? "").slice(0, 110)}&rdquo;
              </p>
              <p className="font-mono text-[9px] text-dim/60 mt-4 tracking-[0.3em]">
                SCD · OPENF1 + FASTF1
              </p>
            </div>
          </div>
          <button onClick={download} disabled={saving} data-cursor="download"
            className="cut px-4 py-2 mt-4 font-mono text-[10px] tracking-widest hover:text-race-red disabled:opacity-50">
            {saving ? "RENDERING…" : "DOWNLOAD PNG ↓"}
          </button>
        </div>

        {/* Season ledger */}
        <div className="lg:col-span-3 cut p-6">
          <div className="flex items-baseline justify-between">
            <p className="display text-sm">SEASON LEDGER</p>
            <p className="font-mono text-[10px] text-dim">{sessions.length} SESSIONS</p>
          </div>
          <p className="font-mono text-[10px] text-dim mt-1 leading-relaxed">
            cross-race state trends — the objective data channel for a driver-vs-car call.
            Sparklines are real arousal z-scores from that driver&apos;s own clips.
          </p>
          <table className="w-full font-mono text-[11px] mt-5">
            <thead className="text-dim/70 text-left">
              <tr className="border-b border-line">
                <th className="py-2 font-normal tracking-widest">SESSION</th>
                <th className="font-normal tracking-widest">DRV</th>
                <th className="font-normal tracking-widest">AROUSAL TREND</th>
                <th className="text-right font-normal tracking-widest">DRIVER</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.key}
                  className={`border-b border-line/50 transition-colors hover:bg-race-white/[0.03] ${
                    session?.key === s.key ? "text-race-white" : "text-dim"}`}>
                  <td className="py-2.5">
                    {session?.key === s.key && <span className="text-race-red mr-1.5">▸</span>}
                    {s.year} {s.gp.toUpperCase()}
                  </td>
                  <td className="text-race-white/90">{s.driver}</td>
                  <td><Sparkline values={s.spark} /></td>
                  <td className="text-right">
                    {s.driver_clips ?? "—"}<span className="text-dim/50">/{s.clip_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-mono text-[10px] text-dim/70 mt-4 leading-relaxed">
            DRIVER column = clips that are the driver speaking, out of all radio for that
            session. Team radio carries both sides and labels neither.
          </p>

          <div className="mt-8">
            <p className="font-mono text-[10px] text-dim tracking-widest mb-3">REAL RADIO, FOR REAL</p>
            <YouTubeEmbed id="GXB1KF72phY" title="Esteban Ocon — Full Race Team Radio, 2025 Emilia-Romagna GP" />
          </div>
        </div>
      </div>
    </section>
  );
}
