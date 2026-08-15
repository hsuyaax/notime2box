"use client";
// Shared-x charts: lap-time line (pit ghosted) over state trace + confidence band.
// Hand-rolled SVG — two custom charts don't earn a chart library.
import { useMemo, useRef } from "react";
import { Alert, ClipScore, LapPoint, TracePoint, labelColor } from "@/lib/api";

const W = 1000, H_LAP = 150, H_STATE = 220, PAD = 44;

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
    return [Math.min(...clean) - 0.5, Math.max(...clean) + 0.5];
  }, [laps]);
  const yLap = (v: number) => 10 + (1 - (v - ltMin) / (ltMax - ltMin)) * (H_LAP - 20);
  const yA = (v: number) => 10 + (1 - v) * (H_STATE - 20);

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

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = svgRef.current!.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width * W - PAD) / (W - PAD * 2) * tMax;
    onCursor(Math.max(0, Math.min(tMax, t)));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H_LAP + H_STATE + 30}`}
      className="w-full select-none cursor-crosshair touch-none"
      onPointerDown={drag}
      onPointerMove={drag}
    >
      {/* lap chart */}
      <text x={PAD} y={14} className="fill-[var(--dim)]" fontSize={10} fontFamily="monospace">LAP TIME</text>
      {lapTimes.filter((l) => l.is_pit).map((l) => (
        <circle key={l.lap} cx={x(l.t_start_s)} cy={yLap(Math.min(l.lap_time_s!, ltMax))}
          r={3} fill="none" stroke="var(--dim)" opacity={0.4} />
      ))}
      <path d={lapPath} fill="none" stroke="var(--white)" strokeWidth={1.5} opacity={0.85} />

      <g transform={`translate(0 ${H_LAP + 30})`}>
        <text x={PAD} y={4} className="fill-[var(--dim)]" fontSize={10} fontFamily="monospace">
          DRIVER STATE · AROUSAL ± 1.5σ
        </text>
        {/* alert regions */}
        {alerts.map((a, i) => (
          <rect key={i} x={x(a.t_start)} y={8}
            width={Math.max(x(a.t_end ?? a.t_start + 30) - x(a.t_start), 4)} height={H_STATE - 16}
            fill={a.type === "red_mist" ? "var(--red)" : "var(--amber)"} opacity={0.08} />
        ))}
        <path d={bandPath} fill="var(--red)" opacity={0.13} />
        <path d={meanPath} fill="none" stroke="var(--red)" strokeWidth={2} />
        {clips.map((c) => (
          <g key={c.clip_id} onClick={(e) => { e.stopPropagation(); onClip(c); }} className="cursor-pointer">
            <circle cx={x(c.t_session_s)} cy={yA(c.arousal)} r={selected === c.clip_id ? 7 : 5}
              fill={labelColor(c.label)} stroke="var(--bg)" strokeWidth={1.5}>
              {Math.abs(c.arousal_z) > 1.5 && (
                <animate attributeName="r" values="5;7;5" dur="1.6s" repeatCount="indefinite" />
              )}
            </circle>
          </g>
        ))}
      </g>

      {/* scrubber sweeps both charts */}
      <line x1={x(cursor)} x2={x(cursor)} y1={8} y2={H_LAP + H_STATE + 22}
        stroke="var(--white)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
    </svg>
  );
}
