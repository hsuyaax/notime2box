"use client";
// Slide-up clip detail: emotion-tinted waveform, per-word ASR-confidence transcript,
// signal mini-bars, z-scores.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import WaveSurfer from "wavesurfer.js";
import { ClipScore, audioSrc, fmtT, labelColor } from "@/lib/api";

function Bar({ name, v }: { name: string; v: number }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
      <span className="w-16">{name}</span>
      <div className="h-1.5 flex-1 bg-line">
        <div className="h-full bg-race-red" style={{ width: `${Math.min(v, 1) * 100}%` }} />
      </div>
      <span className="w-8 text-right">{v.toFixed(2)}</span>
    </div>
  );
}

export default function ClipPanel({ clip, steiner }: { clip: ClipScore; steiner: boolean }) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    wsRef.current?.destroy();
    wsRef.current = null;
    if (waveRef.current && clip.audio_url) {
      const ws = WaveSurfer.create({
        container: waveRef.current,
        height: 56,
        waveColor: labelColor(clip.label),
        progressColor: "var(--white)",
        cursorColor: "var(--white)",
        url: audioSrc(clip.audio_url),
        barWidth: 2,
        barGap: 1,
      });
      wsRef.current = ws;
      return () => ws.destroy();
    }
  }, [clip.clip_id]);

  const label = steiner
    ? { calm: "CALM", stressed: "FULL GUENTHER", tired: "SPICY", uncertain: "??" }[clip.label]
    : clip.label.toUpperCase();

  return (
    <motion.div
      key={clip.clip_id}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="cut p-5"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs text-dim">
          LAP {clip.lap ?? "—"} · {fmtT(clip.t_session_s)} · ASR {clip.asr_model.toUpperCase()} ·{" "}
          {(clip.asr_conf * 100).toFixed(0)}%
        </p>
        <span className="display text-sm" style={{ color: labelColor(clip.label) }}>
          {label} · z {clip.arousal_z > 0 ? "+" : ""}{clip.arousal_z.toFixed(1)}
        </span>
      </div>

      {clip.audio_url ? (
        <div
          ref={waveRef}
          className="mt-3 cursor-pointer"
          onClick={() => wsRef.current?.playPause()}
          title="click to play"
        />
      ) : (
        <div className="mt-3 h-14 flex items-end gap-0.5">
          {Array.from({ length: 80 }, (_, i) => (
            <div key={i} className="flex-1" style={{
              height: `${20 + 70 * Math.abs(Math.sin(i * 1.7 + clip.arousal * 9)) * clip.arousal}%`,
              background: labelColor(clip.label), opacity: 0.7,
            }} />
          ))}
        </div>
      )}

      <p className="mt-3 text-lg leading-snug">
        {clip.word_confs.length
          ? clip.word_confs.map(([w, c], i) => (
              <span key={i} style={{ opacity: 0.35 + 0.65 * c }}>{w} </span>
            ))
          : clip.transcript || <span className="text-dim italic">no transcript</span>}
      </p>

      <div className="grid grid-cols-3 gap-x-6 gap-y-1 mt-4">
        <Bar name="acoustic" v={clip.arousal} />
        <Bar name="prosody" v={clip.prosody.rate_sps / 8} />
        <Bar name="text" v={Object.values(clip.text_emotion).length
          ? (clip.text_emotion.anger ?? 0) + (clip.text_emotion.fear ?? 0) + (clip.text_emotion.sadness ?? 0)
          : 0} />
        <Bar name="valence" v={clip.valence} />
        <Bar name="pause" v={clip.prosody.pause_ratio} />
        <Bar name="conf" v={clip.confidence} />
      </div>
      {!clip.signals_agree && (
        <p className="font-mono text-[10px] text-amber mt-2">
          SIGNALS DISAGREE — LOW CONFIDENCE, NOT A FORCED LABEL
        </p>
      )}
    </motion.div>
  );
}
