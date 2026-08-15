"use client";
// Standing assessment for the alert column.
//
// An alert-only panel is silent in exactly the case that matters most: when the
// system has looked and found nothing. That reads as "broken", not "clear", and it
// gives a pit wall no way to tell the difference. So the panel always states a
// verdict and what it rests on — quiet is a finding, and quiet with low confidence
// is a different finding from quiet with high confidence.
import { Alert, ClipScore, FatigueDiag, TracePoint } from "@/lib/api";

type Props = { clips: ClipScore[]; trace: TracePoint[]; alerts: Alert[]; fatigue?: FatigueDiag };

export default function SessionVerdict({ clips, trace, alerts, fatigue }: Props) {
  if (!clips.length) return null;

  const regimes = new Set(trace.map((p) => p.regime_id)).size;
  const meanConf = clips.reduce((a, c) => a + c.confidence, 0) / clips.length;
  const disagreed = clips.filter((c) => !c.signals_agree).length;
  const peak = clips.reduce((a, b) => (b.arousal_z > a.arousal_z ? b : a));
  const lowest = clips.reduce((a, b) => (b.arousal_z < a.arousal_z ? b : a));

  const flagged = clips.filter((c) => c.label === "stressed" || c.label === "tired").length;
  const clear = alerts.length === 0;

  // Confidence in the verdict itself is limited by the evidence available: a
  // 3-clip session cannot support a strong claim either way, and we say so
  // rather than projecting false calm.
  const thin = clips.length < 8;

  return (
    <div className="cut p-4 font-mono text-xs">
      <p className="text-dim tracking-widest">SESSION ASSESSMENT</p>
      <p className="display text-base mt-1" style={{ color: clear ? "var(--green)" : "var(--red)" }}>
        {clear ? "NO ALERT CONDITIONS MET" : `${alerts.length} ALERT${alerts.length > 1 ? "S" : ""} RAISED`}
      </p>

      <table className="w-full text-dim mt-3">
        <tbody>
          {[
            ["clips analysed", String(clips.length)],
            ["state regimes", String(regimes)],
            ["flagged clips", `${flagged} / ${clips.length}`],
            ["peak arousal", `${peak.arousal_z > 0 ? "+" : ""}${peak.arousal_z.toFixed(1)}σ${peak.lap ? ` · lap ${peak.lap}` : ""}`],
            ["lowest arousal", `${lowest.arousal_z.toFixed(1)}σ${lowest.lap ? ` · lap ${lowest.lap}` : ""}`],
            ["mean confidence", meanConf.toFixed(2)],
            ["signals disagreed", `${disagreed} / ${clips.length}`],
          ].map(([k, v]) => (
            <tr key={k} className="border-t border-line/60">
              <td className="py-1 pr-3">{k}</td>
              <td className="py-1 text-right text-race-white">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {fatigue?.available && (
        <div className="mt-3 pt-3 border-t border-line/60">
          <p className="text-dim tracking-widest">FATIGUE TEST · EARLY vs LATE</p>
          <table className="w-full text-dim mt-2">
            <tbody>
              <tr className="border-t border-line/40">
                <td className="py-1">effect size (Hedges g)</td>
                <td className="py-1 text-right" style={{ color: fatigue.effect_met ? "var(--amber)" : "var(--white)" }}>
                  {fatigue.effect_size_g?.toFixed(2)} / {fatigue.effect_threshold?.toFixed(1)}
                </td>
              </tr>
              <tr className="border-t border-line/40">
                <td className="py-1">lap delta</td>
                <td className="py-1 text-right" style={{ color: fatigue.lap_met ? "var(--amber)" : "var(--white)" }}>
                  {(fatigue.lap_delta_s ?? 0) > 0 ? "+" : ""}{fatigue.lap_delta_s?.toFixed(2)}s / +{fatigue.lap_threshold?.toFixed(2)}s
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-dim mt-2 leading-relaxed normal-case">
            Both must clear for a fatigue alert. Voice decline alone never fires — a
            quiet driver who is lapping fine is not a fatigued driver.
          </p>
        </div>
      )}

      <p className="text-dim mt-3 leading-relaxed normal-case">
        {clear ? (
          <>
            Fatigue Drift needs a sustained regime shift corroborated by lap-time loss;
            Red Mist needs a frustration spike above this driver&apos;s own baseline. Neither
            threshold was met.
          </>
        ) : (
          <>Evidence for each alert is listed on its card — every trigger is auditable.</>
        )}
        {thin && (
          <>
            {" "}
            <span className="text-amber">
              Only {clips.length} clips in this session — too thin to support a strong claim
              either way.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
