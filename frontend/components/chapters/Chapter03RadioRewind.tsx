"use client";
// CHAPTER 03 — RADIO REWIND. The centrepiece: pinned analysis screen (lap chart +
// state trace + confidence band + pulsing clip markers + scrubber + alert toasts),
// then a horizontal GSAP scroll rail of the session's clips below.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import RaceCharts from "@/components/RaceCharts";
import ClipPanel from "@/components/ClipPanel";
import AlertCard from "@/components/AlertCard";
import SessionVerdict from "@/components/SessionVerdict";
import { ClipScore, SessionMeta, Trace, fmtT, getClips, getTrace, labelColor } from "@/lib/api";
import { MOCK_CLIPS, MOCK_TRACE_RESULT } from "@/lib/mockData";
import { useReducedMotion } from "@/lib/smoothScroll";

/** Rail card. Wider and shorter than before so a full radio call is actually
 *  readable — the transcript was clipped at two lines and the numbers that justify
 *  the label (z-score, confidence, ASR source) weren't shown at all. Clicking one
 *  selects that clip in the charts above, which it always should have done. */
function RailCard({ c, active, onSelect }: {
  c: ClipScore; active: boolean; onSelect: () => void;
}) {
  const isEng = c.speaker === "engineer";
  const tint = isEng ? "var(--dim)" : labelColor(c.label);
  return (
    <button
      onClick={onSelect}
      data-cursor="select"
      className={`cut w-[22rem] sm:w-[26rem] shrink-0 p-5 mr-4 snap-start text-left
                  transition-colors hover:bg-race-white/[0.03]
                  ${active ? "ring-1 ring-race-red" : ""}`}
    >
      {/* header: where in the race, and how long the call was */}
      <div className="flex items-baseline justify-between font-mono text-[10px] text-dim">
        {/* negative session time = before lights out; "LAP — · -43:17" is accurate
            but reads like a bug, so name what it actually is */}
        <span>
          {c.t_session_s < 0
            ? `GRID · ${fmtT(c.t_session_s)}`
            : `LAP ${c.lap ?? "—"} · ${fmtT(c.t_session_s)}`}
        </span>
        <span>{c.duration_s.toFixed(1)}s</span>
      </div>

      {/* verdict line */}
      <div className="flex items-baseline justify-between gap-3 mt-2">
        {isEng ? (
          <span className="display text-sm text-amber">ENGINEER · NOT SCORED</span>
        ) : (
          <>
            <span className="display text-base" style={{ color: tint }}>
              {c.label.toUpperCase()}
            </span>
            <span className="font-mono text-[11px]" style={{ color: tint }}>
              z {c.arousal_z > 0 ? "+" : ""}{c.arousal_z.toFixed(2)}
            </span>
          </>
        )}
      </div>

      <div className="mt-3 h-8 flex items-end gap-0.5">
        {Array.from({ length: 56 }, (_, i) => (
          <div key={i} className="flex-1" style={{
            height: `${15 + 70 * Math.abs(Math.sin(i * 1.9 + c.arousal * 9)) * c.arousal}%`,
            background: tint,
            opacity: isEng ? 0.4 : 0.7,
          }} />
        ))}
      </div>

      {/* the actual radio call — the point of the card, so give it room */}
      <p className="mt-3 text-sm leading-snug text-race-white/85 line-clamp-4 min-h-[4.5rem]">
        &ldquo;{c.transcript || "—"}&rdquo;
      </p>

      <div className="flex items-center justify-between font-mono text-[10px] text-dim/70
                      border-t border-line pt-2 mt-1">
        <span>ASR {c.asr_model.toUpperCase()} · {(c.asr_conf * 100).toFixed(0)}%</span>
        {!isEng && <span>CONF {(c.confidence * 100).toFixed(0)}%</span>}
      </div>
    </button>
  );
}

export default function Chapter03RadioRewind({ session }: { session: SessionMeta | null }) {
  const [clips, setClips] = useState<ClipScore[]>(MOCK_CLIPS);
  const [trace, setTrace] = useState<Trace>(MOCK_TRACE_RESULT);
  const [engine, setEngine] = useState<"naive" | "bayes">("bayes");
  const [cursor, setCursor] = useState(0);
  const [sel, setSel] = useState<ClipScore | null>(MOCK_CLIPS[0]);
  const [railGrid, setRailGrid] = useState(false);
  const [steiner, setSteiner] = useState(false);
  const reduced = useReducedMotion();
  const pinRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    getClips(session.key).then(setClips).catch(() => setClips(MOCK_CLIPS));
    getTrace(session.key, engine).then(setTrace).catch(() => setTrace(MOCK_TRACE_RESULT));
  }, [session, engine]);

  const visibleAlerts = trace.alerts.filter((a) => a.t_start <= cursor);

  useEffect(() => {
    const passed = clips.filter((c) => c.t_session_s <= cursor);
    if (passed.length) setSel(passed[passed.length - 1]);
  }, [cursor, clips]);

  // horizontal scroll rail — pin the section, translate the track sideways with scroll.
  // Distance and pin length are read live (functions, not captured numbers) so it
  // stays correct across clip counts and window resizes; a minimum pin length keeps
  // short rails (few clips) from flashing past in one wheel tick.
  useEffect(() => {
    if (reduced || railGrid || !railRef.current || !railTrackRef.current) return;
    // narrow/touch viewports get native horizontal swipe instead (see track classes)
    if (window.matchMedia("(max-width: 767px), (pointer: coarse)").matches) return;
    const track = railTrackRef.current;
    const container = railRef.current;
    const getDistance = () => Math.max(track.scrollWidth - container.clientWidth, 0);
    if (getDistance() < 40) return; // already fits — no need to hijack scroll

    const tween = gsap.to(track, {
      x: () => -getDistance(),
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top top+=80",
        end: () => `+=${Math.max(getDistance(), window.innerHeight * 0.6)}`,
        scrub: 0.5,
        pin: true,
        invalidateOnRefresh: true,
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced, railGrid, clips]);

  return (
    <section id="ch-rewind" className="relative">
      <div ref={pinRef} className="min-h-screen px-6 py-10 max-w-7xl mx-auto w-full flex flex-col justify-center">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="font-mono text-xs text-dim tracking-widest">03 · RADIO REWIND</p>
            <h2 className="display text-3xl mt-1">
              {session ? session.driver : "DEMO"} <span className="text-race-red">{session ? `${session.year} ${session.gp.toUpperCase()}` : "SESSION"}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSteiner(!steiner)}
              title="settings"
              className={`cut px-2 py-1.5 font-mono text-[10px] ${steiner ? "text-amber" : "text-dim"}`}
            >
              GS
            </button>
            <div className="cut flex" data-cursor="drag">
              {(["naive", "bayes"] as const).map((e) => (
                <button key={e} onClick={() => setEngine(e)}
                  className={`px-3 py-1.5 font-mono text-xs ${engine === e ? "bg-race-red text-race-white" : "text-dim"}`}>
                  {e === "bayes" ? "BAYESIAN" : "NAIVE"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cut p-4">
          <RaceCharts
            clips={clips} trace={trace.trace} laps={trace.laps} alerts={visibleAlerts}
            cursor={cursor} onCursor={setCursor}
            onClip={(c) => { setSel(c); setCursor(c.t_session_s); }}
            selected={sel?.clip_id}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-start">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {sel && <ClipPanel clip={sel} steiner={steiner} />}
            </AnimatePresence>
          </div>
          <div className="flex flex-col gap-3 min-h-[3rem]">
            <AnimatePresence>
              {visibleAlerts.slice(-2).reverse().map((a) => (
                <AlertCard key={`${a.type}${a.t_start}`} alert={a} />
              ))}
            </AnimatePresence>
            <SessionVerdict clips={clips} trace={trace.trace} alerts={trace.alerts} fatigue={trace.fatigue} speakers={trace.speakers} />
          </div>
        </div>
      </div>

      {/* horizontal rail of clips below the pinned analysis screen */}
      <div ref={railRef} className="relative py-16 border-t border-line md:overflow-hidden">
        <div className="flex items-center justify-between px-6 max-w-7xl mx-auto mb-6">
          <p className="font-mono text-xs text-dim tracking-widest">ALL CLIPS · {clips.length}</p>
          <button onClick={() => setRailGrid(!railGrid)} className="font-mono text-xs text-dim hover:text-race-white underline underline-offset-4">
            {railGrid ? "SCROLL VIEW" : "CHANGE VIEW → GRID"}
          </button>
        </div>
        {railGrid ? (
          <div className="flex flex-wrap gap-y-4 px-6 max-w-7xl mx-auto">
            {clips.map((c) => (
              <RailCard key={c.clip_id} c={c} active={sel?.clip_id === c.clip_id}
                onSelect={() => { setSel(c); setCursor(c.t_session_s); }} />
            ))}
          </div>
        ) : (
          <div ref={railTrackRef} data-cursor="drag"
            className="flex px-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none"
            style={{ willChange: "transform" }}>
            {clips.map((c) => (
              <RailCard key={c.clip_id} c={c} active={sel?.clip_id === c.clip_id}
                onSelect={() => { setSel(c); setCursor(c.t_session_s); }} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
