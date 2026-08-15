"use client";
// CHAPTER 02 — THE GARAGE. Full-height driver cards, giant race number as art,
// hover parallax + underline sweep, pit-board loading sequence on select.
import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { API, SessionMeta, getSessions } from "@/lib/api";
import { MOCK_SESSIONS } from "@/lib/mockData";
import MaskedHeading from "@/components/MaskedHeading";

function DriverCard({ s, i, active, onSelect }: { s: SessionMeta; i: number; active: boolean; onSelect: () => void }) {
  const mx = useMotionValue(0.5);
  const numX = useTransform(mx, [0, 1], [-8, 8]);

  return (
    <motion.button
      onClick={onSelect}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
      }}
      data-cursor="select"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className={`cut relative overflow-hidden text-left flex-1 min-h-[420px] p-8 group ${active ? "ring-1 ring-race-red" : ""}`}
    >
      <motion.span
        style={{ x: numX }}
        className="num-speed text-[9rem] leading-none text-race-white/10 absolute right-2 top-2 group-hover:text-race-red/25 transition-colors"
      >
        {s.driver_number ?? "—"}
      </motion.span>
      <p className="font-mono text-xs text-dim">{s.year} · {s.gp.toUpperCase()} · {s.session}</p>
      <p className="display text-4xl mt-2">{s.driver}</p>
      <p className="font-mono text-xs text-dim mt-6 absolute bottom-8 left-8">
        {s.ready ? `${s.clip_count} RADIO CLIPS · READY` : "PULL RADIO →"}
      </p>
      <span className="block h-0.5 bg-race-red w-0 group-hover:w-[calc(100%-4rem)] transition-all duration-300 absolute bottom-6 left-8" />
    </motion.button>
  );
}

export default function Chapter02Garage({ onSelect, activeKey }: {
  onSelect: (s: SessionMeta) => void; activeKey?: string;
}) {
  const [sessions, setSessions] = useState<SessionMeta[]>(MOCK_SESSIONS);
  const [loading, setLoading] = useState<{ key: string; done: number; total: number } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getSessions().then((s) => s.length && setSessions(s)).catch(() => setErr("backend offline — showing demo sessions"));
  }, []);

  const open = async (s: SessionMeta) => {
    if (s.ready) return onSelect(s);
    await fetch(`${API}/api/sessions/${s.key}/load`, { method: "POST" }).catch(() => {});
    const es = new EventSource(`${API}/api/sessions/${s.key}/progress`);
    es.onmessage = (e) => {
      const p = JSON.parse(e.data);
      setLoading({ key: s.key, done: p.done, total: p.total });
      if (p.status !== "running") {
        es.close();
        if (p.status === "done") onSelect(s);
        else setErr(String(p.status));
      }
    };
  };

  return (
    <section id="ch-garage" className="min-h-screen px-6 py-24 max-w-7xl mx-auto w-full">
      <p className="font-mono text-xs text-dim tracking-widest">02 · THE GARAGE</p>
      <MaskedHeading as="h2" className="display text-4xl mt-2" lines={["SELECT A SESSION"]} />
      {err && <p className="mt-3 font-mono text-xs text-amber">{err}</p>}

      <div className="flex flex-col md:flex-row gap-4 mt-10">
        {sessions.map((s, i) => (
          <DriverCard key={s.key} s={s} i={i} active={activeKey === s.key} onSelect={() => open(s)} />
        ))}
      </div>

      {loading && (
        <div className="cut mt-6 p-4 font-mono text-sm text-amber">
          PULLING RADIO… {loading.done}/{loading.total || "?"} CLIPS
        </div>
      )}
    </section>
  );
}
