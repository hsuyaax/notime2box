"use client";
// CHAPTER 02 — THE GARAGE. Full-height driver cards, giant race number as art,
// hover parallax + underline sweep, pit-board loading sequence on select.
import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { API, DriverOption, RaceOption, SessionMeta, getDrivers, getRaces, getSessions } from "@/lib/api";
import { MOCK_SESSIONS } from "@/lib/mockData";
import MaskedHeading from "@/components/MaskedHeading";
import YouTubeEmbed from "@/components/YouTubeEmbed";

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

function AnyRacePicker({ onLoad }: { onLoad: (s: SessionMeta) => void }) {
  const years = [2023, 2024, 2025];
  const [year, setYear] = useState(2024);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [race, setRace] = useState<RaceOption | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driver, setDriver] = useState<DriverOption | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setRace(null); setDrivers([]); setDriver(null);
    getRaces(year).then(setRaces).catch(() => setErr("couldn't reach OpenF1"));
  }, [year]);

  useEffect(() => {
    setDriver(null);
    if (!race) return setDrivers([]);
    getDrivers(year, race.session_key).then(setDrivers).catch(() => setErr("couldn't reach OpenF1"));
  }, [race, year]);

  const load = async () => {
    if (!race || !driver) return;
    setErr("");
    const key = `${year}_${race.gp_slug}_R_${driver.acronym}`;
    setBusy("PULLING RADIO…");
    await fetch(`${API}/api/sessions/${key}/load`, { method: "POST" }).catch(() => {});
    const es = new EventSource(`${API}/api/sessions/${key}/progress`);
    es.onmessage = (e) => {
      const p = JSON.parse(e.data);
      setBusy(`PULLING RADIO… ${p.done}/${p.total || "?"} CLIPS`);
      if (p.status !== "running") {
        es.close();
        setBusy(null);
        if (p.status === "done") {
          onLoad({ key, year, gp: race.gp_slug, session: "R", driver: driver.acronym,
                   driver_number: driver.driver_number, clip_count: 0, ready: true });
        } else {
          setErr(p.status === "error: session not found on OpenF1"
            ? "no radio data for this driver at this race (real gap — not every session has coverage)"
            : String(p.status));
        }
      }
    };
  };

  return (
    <div className="cut p-5 mt-4">
      <p className="font-mono text-[10px] text-dim tracking-widest mb-3">
        LOAD ANY REAL 2023–2025 RACE · LIVE FROM OPENF1 + FASTF1
      </p>
      <div className="flex flex-wrap gap-3">
        {/* clip-path must never sit on a <select> itself — it corrupts the native
            dropdown popup's position/rendering in most browsers. Cut the wrapper,
            leave the form control itself un-clipped. */}
        <div className="cut bg-panel">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent px-3 py-2 font-mono text-xs text-race-white outline-none border-0">
            {years.map((y) => <option key={y} value={y} className="bg-panel">{y}</option>)}
          </select>
        </div>
        <div className="cut bg-panel">
          <select value={race?.session_key ?? ""} onChange={(e) => setRace(races.find((r) => r.session_key === Number(e.target.value)) ?? null)}
            className="bg-transparent px-3 py-2 font-mono text-xs text-race-white outline-none border-0 min-w-[10rem]">
            <option value="" className="bg-panel">SELECT RACE</option>
            {races.map((r) => <option key={r.session_key} value={r.session_key} className="bg-panel">{r.country_name}</option>)}
          </select>
        </div>
        <div className={`cut bg-panel ${!race ? "opacity-40" : ""}`}>
          <select value={driver?.acronym ?? ""} onChange={(e) => setDriver(drivers.find((d) => d.acronym === e.target.value) ?? null)}
            disabled={!race} className="bg-transparent px-3 py-2 font-mono text-xs text-race-white outline-none border-0 min-w-[10rem]">
            <option value="" className="bg-panel">SELECT DRIVER</option>
            {drivers.map((d) => <option key={d.acronym} value={d.acronym} className="bg-panel">{d.full_name}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={!driver || !!busy} data-cursor="select"
          className="cut px-4 py-2 font-mono text-xs bg-race-red text-race-white disabled:opacity-40">
          LOAD →
        </button>
      </div>
      {busy && <p className="font-mono text-xs text-amber mt-3">{busy}</p>}
      {err && <p className="font-mono text-xs text-amber mt-3">{err}</p>}
    </div>
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

      <AnyRacePicker onLoad={onSelect} />

      <div className="mt-16 max-w-xl">
        <p className="font-mono text-[10px] text-dim tracking-widest mb-3">HEAR IT FOR YOURSELF</p>
        <YouTubeEmbed id="qdQNfF1-2rw" title="Lando Norris — Greatest Team Radio Moments" />
      </div>
    </section>
  );
}
