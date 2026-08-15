"use client";
// Shared-x instrument stack, top to bottom:
//   1. LAP TIME      — the corroborating physical signal (pit laps ghosted)
//   2. DRIVER STATE  — Kalman posterior mean + ±1.5σ band (the band IS the covariance:
//                      it visibly widens across radio silence, snaps tight on a clip)
//   3. P(CHANGE)     — BOCPD run-length posterior collapse; regime boundaries ticked
// Hand-rolled SVG on purpose: two bespoke charts sharing an axis, a changepoint lane
// and a scrubber don't earn a chart library's abstraction cost.
import { useMemo, useRef } from "react";
import { Alert, ClipScore, LapPoint, TracePoint, labelColor } from "@/lib/api";

const W = 1000, H_LAP = 132, H_STATE = 210, H_CP = 46, GAP = 26, PAD = 46;
const H_TOTAL = H_LAP + GAP + H_STATE + GAP + H_CP + 16;

type Props = {
  clips: ClipScore[];
  trace: TracePoint[];
  laps: LapPoint[];
  alerts: Alert[];
  cursor: number;              // t_session_s
  onCursor: (t: number) => void;
  onClip: (c: ClipScore) => void;
  selected?: string;
};

export default function RaceCharts({ clips, trace, laps, alerts, cursor, onCursor, onClip, selected }: Props) {
  const tMax = useMemo(
    () => Math.max(...trace.map((p) => p.t), ...clips.map((c) => c.t_session_s), 1),
    [trace, clips]
  );
  const x = (t: number) => PAD + (t / tMax) * (W - PAD * 2);

  const lapTimes = laps.filter((l) => l.lap_time_s != null);
  const [ltMin, ltMax] = useMemo(() => {
    const clean = lapTimes.filter((l) => !l.is_pit).map((l) => l.lap_time_s!);
    if (!clean.length) return [0, 1];
    return [Math.min(...clean) - 0.5, Math.max(...clean) + 0.5];
  }, [laps]);
  const yLap = (v: number) => 10 + (1 - (v - ltMin) / (ltMax - ltMin)) * (H_LAP - 20);

  // Autoscale the state panel to the band's actual extent. Arousal lives around
  // 0.5-0.6 on a [0,1] scale, so a fixed axis renders every real session as a flat
  // line and hides exactly the variation this product exists to show. Axis ticks
  // below print the true values so autoscaling can't overstate a small movement.
  const [aLo, aHi] = useMemo(() => {
    if (!trace.length) return [0, 1];
    let lo = Math.min(...trace.map((p) => p.mean[0] - 1.5 * p.std[0]),
                      ...clips.map((c) => c.arousal));
    let hi = Math.max(...trace.map((p) => p.mean[0] + 1.5 * p.std[0]),
                      ...clips.map((c) => c.arousal));
    const pad = Math.max((hi - lo) * 0.12, 0.02);
    return [Math.max(0, lo - pad), Math.min(1, hi + pad)];
  }, [trace, clips]);
  const yA = (v: number) =>
    10 + (1 - (v - aLo) / Math.max(aHi - aLo, 1e-6)) * (H_STATE - 20);

  const lapPath = lapTimes
    .filter((l) => !l.is_pit)
    .map((l, i) => `${i ? "L" : "M"}${x(l.t_start_s).toFixed(1)},${yLap(l.lap_time_s!).toFixed(1)}`)
    .join(" ");

  const meanPath = trace
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${yA(p.mean[0]).toFixed(1)}`)
    .join(" ");

  const bandPath = useMemo(() => {
    if (!trace.length) return "";
    const up = trace.map((p) => `${x(p.t).toFixed(1)},${yA(Math.min(p.mean[0] + 1.5 * p.std[0], 1)).toFixed(1)}`);
    const dn = [...trace].reverse().map((p) => `${x(p.t).toFixed(1)},${yA(Math.max(p.mean[0] - 1.5 * p.std[0], 0)).toFixed(1)}`);
    return `M${up.join(" L")} L${dn.join(" L")} Z`;
  }, [trace, tMax]);

  // widest band point = the honest "we don't know right now" moment; worth calling out
  const widest = useMemo(() => {
    if (trace.length < 3) return null;
    return trace.reduce((a, b) => (b.std[0] > a.std[0] ? b : a));
  }, [trace]);

  // regime boundaries from BOCPD (regime_id increments on a detected changepoint)
  const regimeEdges = useMemo(
    () => trace.filter((p, i) => i > 0 && p.regime_id !== trace[i - 1].regime_id),
    [trace]
  );
  const maxP = useMemo(() => Math.max(...trace.map((p) => p.p_change), 0.001), [trace]);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = svgRef.current!.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width * W - PAD) / (W - PAD * 2) * tMax;
    onCursor(Math.max(0, Math.min(tMax, t)));
  };

  const yState = H_LAP + GAP;
  const yCp = yState + H_STATE + GAP;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H_TOTAL}`}
      className="w-full select-none cursor-crosshair touch-none"
      onPointerDown={drag}
      onPointerMove={drag}
    >
      <defs>
        <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--red)" stopOpacity="0.30" />
          <stop offset="50%" stopColor="var(--red)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--red)" stopOpacity="0.30" />
        </linearGradient>
      </defs>

      {/* ---------- 1. LAP TIME ---------- */}
      <text x={PAD} y={12} className="fill-[var(--dim)]" fontSize={9} fontFamily="monospace" letterSpacing="1.5">
        LAP TIME
      </text>
      {lapTimes.filter((l) => l.is_pit).map((l) => (
        <g key={l.lap}>
          <line x1={x(l.t_start_s)} x2={x(l.t_start_s)} y1={8} y2={H_LAP - 8}
            stroke="var(--dim)" strokeWidth={1} strokeDasharray="2 4" opacity={0.35} />
          <text x={x(l.t_start_s) + 3} y={H_LAP - 10} className="fill-[var(--dim)]" fontSize={8} fontFamily="monospace">PIT</text>
        </g>
      ))}
      <path d={lapPath} fill="none" stroke="var(--white)" strokeWidth={1.4} opacity={0.85} />

      {/* ---------- 2. DRIVER STATE + CONFIDENCE BAND ---------- */}
      <g transform={`translate(0 ${yState})`}>
        <text x={PAD} y={2} className="fill-[var(--dim)]" fontSize={9} fontFamily="monospace" letterSpacing="1.5">
          DRIVER STATE · KALMAN POSTERIOR ± 1.5σ
        </text>
        {[aHi, (aHi + aLo) / 2, aLo].map((v, i) => (
          <g key={i}>
            <line x1={PAD} x2={W - PAD} y1={yA(v)} y2={yA(v)}
              stroke="var(--line)" strokeWidth={0.5} opacity={0.55} />
            <text x={8} y={yA(v) + 3} className="fill-[var(--dim)]" fontSize={8} fontFamily="monospace">
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* alert regions sit behind everything */}
        {alerts.map((a, i) => (
          <rect key={i} x={x(a.t_start)} y={8}
            width={Math.max(x(a.t_end ?? a.t_start + 30) - x(a.t_start), 3)} height={H_STATE - 16}
            fill={a.type === "red_mist" ? "var(--red)" : "var(--amber)"} opacity={0.09} />
        ))}

        {/* regime boundary rules — BOCPD said "the process changed here" */}
        {regimeEdges.map((p, i) => (
          <line key={i} x1={x(p.t)} x2={x(p.t)} y1={8} y2={H_STATE - 8}
            stroke="var(--amber)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        ))}

        <path d={bandPath} fill="url(#bandGrad)" />
        <path d={meanPath} fill="none" stroke="var(--red)" strokeWidth={2} />

        {/* the honest moment: widest uncertainty */}
        {widest && widest.std[0] > 0.05 && (
          <g opacity={0.75}>
            <line x1={x(widest.t)} x2={x(widest.t)}
              y1={yA(Math.min(widest.mean[0] + 1.5 * widest.std[0], 1))}
              y2={yA(Math.max(widest.mean[0] - 1.5 * widest.std[0], 0))}
              stroke="var(--white)" strokeWidth={1} />
            <text x={x(widest.t) + 4} y={yA(Math.min(widest.mean[0] + 1.5 * widest.std[0], 1)) - 4}
              className="fill-[var(--white)]" fontSize={8} fontFamily="monospace">
              ±{(1.5 * widest.std[0]).toFixed(2)} WIDEST
            </text>
          </g>
        )}

        {clips.map((c) => (
          <g key={c.clip_id} onClick={(e) => { e.stopPropagation(); onClip(c); }} className="cursor-pointer">
            <circle cx={x(c.t_session_s)} cy={yA(c.arousal)} r={selected === c.clip_id ? 7 : 4.5}
              fill={labelColor(c.label)} stroke="var(--bg)" strokeWidth={1.5}>
              {Math.abs(c.arousal_z) > 1.5 && (
                <animate attributeName="r" values="4.5;7;4.5" dur="1.6s" repeatCount="indefinite" />
              )}
            </circle>
            {selected === c.clip_id && (
              <circle cx={x(c.t_session_s)} cy={yA(c.arousal)} r={11} fill="none"
                stroke={labelColor(c.label)} strokeWidth={1} opacity={0.6} />
            )}
          </g>
        ))}
      </g>

      {/* ---------- 3. BOCPD CHANGEPOINT LANE ---------- */}
      <g transform={`translate(0 ${yCp})`}>
        <text x={PAD} y={2} className="fill-[var(--dim)]" fontSize={9} fontFamily="monospace" letterSpacing="1.5">
          P(CHANGEPOINT) · BOCPD RUN-LENGTH POSTERIOR
        </text>
        <line x1={PAD} x2={W - PAD} y1={H_CP - 8} y2={H_CP - 8} stroke="var(--line)" strokeWidth={1} />
        {trace.map((p, i) =>
          p.p_change > 0.02 ? (
            <line key={i} x1={x(p.t)} x2={x(p.t)} y1={H_CP - 8}
              y2={H_CP - 8 - (p.p_change / maxP) * (H_CP - 20)}
              stroke="var(--amber)" strokeWidth={1.5} opacity={0.9} />
          ) : null
        )}
        {!regimeEdges.length && (
          <text x={PAD} y={H_CP - 16} className="fill-[var(--dim)]" fontSize={8} fontFamily="monospace" opacity={0.7}>
            NO REGIME SHIFT DETECTED — STATE HELD ALL SESSION
          </text>
        )}
      </g>

      {/* scrubber sweeps every lane */}
      <line x1={x(cursor)} x2={x(cursor)} y1={6} y2={H_TOTAL - 6}
        stroke="var(--white)" strokeWidth={1} strokeDasharray="3 3" opacity={0.75} />
      <circle cx={x(cursor)} cy={6} r={3} fill="var(--white)" />
    </svg>
  );
}
