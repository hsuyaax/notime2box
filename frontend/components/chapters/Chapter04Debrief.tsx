"use client";
// CHAPTER 04 — THE DEBRIEF. Count-up hero stats, Wrapped card (downloadable PNG),
// season ledger with per-race sparklines in timing-screen style.
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SessionMeta, getSessions, getWrapped } from "@/lib/api";
import { MOCK_SESSIONS, MOCK_WRAPPED } from "@/lib/mockData";
import { useReducedMotion } from "@/lib/smoothScroll";

type Wrapped = typeof MOCK_WRAPPED;

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!ref.current) return;
    if (reduced) { ref.current.textContent = to.toFixed(decimals); return; }
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: to, duration: 1.2, ease: "power2.out",
      onUpdate: () => { if (ref.current) ref.current.textContent = obj.v.toFixed(decimals); },
      scrollTrigger: { trigger: ref.current, start: "top 80%", once: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [to, decimals, reduced]);
  return <span ref={ref}>0</span>;
}

function Sparkline({ seed }: { seed: number }) {
  const pts = Array.from({ length: 24 }, (_, i) => 50 + 30 * Math.sin(i * 0.5 + seed) + 10 * Math.sin(i * 1.3 + seed * 2));
  const max = Math.max(...pts), min = Math.min(...pts);
  const path = pts.map((v, i) => `${i ? "L" : "M"}${(i / 23) * 100},${20 - ((v - min) / (max - min)) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 100 20" className="w-24 h-5 inline-block align-middle">
      <path d={path} fill="none" stroke="var(--red)" strokeWidth={1.5} opacity={0.8} />
    </svg>
  );
}

export default function Chapter04Debrief({ session }: { session: SessionMeta | null }) {
  const [w, setW] = useState<Wrapped>(MOCK_WRAPPED);
  const [sessions, setSessions] = useState<SessionMeta[]>(MOCK_SESSIONS);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    getWrapped(session.key, session.driver).then((d) => setW({ ...MOCK_WRAPPED, ...d })).catch(() => {});
    getSessions().then((s) => s.length && setSessions(s)).catch(() => {});
  }, [session]);

  const download = async () => {
    if (!cardRef.current) return;
    const url = await toPng(cardRef.current, { pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `race-wrapped-${session?.key ?? "demo"}.png`;
    a.click();
  };

  return (
    <section id="ch-debrief" className="min-h-screen px-6 py-24 max-w-6xl mx-auto w-full">
      <p className="font-mono text-xs text-dim tracking-widest">04 · THE DEBRIEF</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div>
          <p className="display text-6xl leading-none"><CountUp to={w.clip_count} /></p>
          <p className="font-mono text-xs text-dim mt-2 tracking-widest">RADIO CALLS</p>
        </div>
        <div>
          <p className="display text-6xl leading-none text-race-red">LAP <CountUp to={w.peak_stress_lap ?? 41} /></p>
          <p className="font-mono text-xs text-dim mt-2 tracking-widest">PEAK STRESS</p>
        </div>
        <div>
          <p className="display text-6xl leading-none"><CountUp to={w.composure ?? 71} /></p>
          <p className="font-mono text-xs text-dim mt-2 tracking-widest">COMPOSURE</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mt-16 items-start">
        <div>
          <div ref={cardRef} className="cut p-8 aspect-[4/5] flex flex-col justify-between bg-panel">
            <div>
              <p className="font-mono text-[10px] text-dim tracking-widest">RACE WRAPPED · THE SILENT CO-DRIVER</p>
              <p className="display text-5xl mt-3">{w.driver}</p>
              <p className="font-mono text-xs text-dim mt-1">
                {w.session.year} {w.session.gp?.toUpperCase()} · {w.clip_count} RADIO CALLS
              </p>
            </div>
            <div className="space-y-3">
              {([["CALM", w.pct_calm, "var(--green)"],
                 ["STRESSED", w.pct_stressed, "var(--red)"],
                 ["TIRED", w.pct_tired, "var(--amber)"]] as const).map(([n, v, c]) => (
                <div key={n}>
                  <div className="flex justify-between font-mono text-xs"><span>{n}</span><span>{v}%</span></div>
                  <div className="h-2 bg-line mt-1"><div className="h-full" style={{ width: `${v}%`, background: c }} /></div>
                </div>
              ))}
            </div>
            <div>
              <p className="font-mono text-[10px] text-dim">SPICIEST RADIO · LAP {w.spiciest_clip.lap ?? "—"} · z +{w.spiciest_clip.arousal_z.toFixed(1)}</p>
              <p className="text-lg leading-snug mt-1">"{w.spiciest_clip.transcript}"</p>
            </div>
          </div>
          <button onClick={download} data-cursor="download" className="cut px-4 py-2 mt-4 font-mono text-xs hover:text-race-red">
            DOWNLOAD PNG ↓
          </button>
        </div>

        <div className="cut p-5">
          <p className="display text-sm">SEASON LEDGER</p>
          <p className="font-mono text-[10px] text-dim mt-1">
            cross-race state trends — the objective data channel for the driver-vs-car call
          </p>
          <table className="w-full font-mono text-xs mt-4">
            <thead className="text-dim text-left">
              <tr><th className="py-1">SESSION</th><th>DRIVER</th><th>TREND</th><th className="text-right">CLIPS</th></tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.key} className="border-t border-line">
                  <td className="py-2">{s.year} {s.gp.toUpperCase()}</td>
                  <td>{s.driver}</td>
                  <td><Sparkline seed={i * 1.7} /></td>
                  <td className="text-right">{s.clip_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
