"use client";
// FIA-race-control-styled alert card: monospace, timestamp, evidence rows.
import { motion } from "framer-motion";
import { Alert, fmtT } from "@/lib/api";

export default function AlertCard({ alert }: { alert: Alert }) {
  const red = alert.type === "red_mist";
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="cut p-4 font-mono text-xs border-l-4"
      style={{ borderLeftColor: red ? "var(--red)" : "var(--amber)" }}
    >
      <p className="text-dim">RACE CONTROL · {fmtT(alert.t_start)}{alert.laps.length ? ` · LAP ${alert.laps[0]}${alert.laps.length > 1 ? `–${alert.laps[alert.laps.length - 1]}` : ""}` : ""}</p>
      <p className="display text-sm mt-1" style={{ color: red ? "var(--red)" : "var(--amber)" }}>
        {red ? "RED MIST" : "FATIGUE DRIFT"} · {(alert.confidence * 100).toFixed(0)}%
      </p>
      <p className="text-race-white/80 mt-1 normal-case">{alert.message}</p>
      <table className="mt-2 text-dim">
        <tbody>
          {Object.entries(alert.evidence).map(([k, v]) => (
            <tr key={k}>
              <td className="pr-4">{k}</td>
              <td className="text-race-white">{typeof v === "number" ? v : String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
