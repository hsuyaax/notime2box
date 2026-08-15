"use client";
// CHAPTER 05 — TRY THE COCKPIT. Giant mic button, live input waveform via Web Audio,
// gauge needle result, Red Mist card on the angry take.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AlertCard from "@/components/AlertCard";
import { API, Alert, labelColor } from "@/lib/api";
import MaskedHeading from "@/components/MaskedHeading";

type MicResult = {
  transcript: string; arousal: number; arousal_z: number; label: string;
  confidence: number; baseline_captured?: boolean; alerts?: Alert[];
};

function LiveWaveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!stream || !active || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d")!;
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const w = canvas.width, h = canvas.height, mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      const n = data.length;
      for (let i = 0; i < n; i++) {
        const amp = (data[i] / 255) * h * 0.9;
        ctx.fillStyle = "var(--red)";
        ctx.fillStyle = "#E6002B";
        ctx.fillRect((i / n) * w, mid - amp / 2, w / n - 1, amp);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); audioCtx.close(); };
  }, [stream, active]);
  return <canvas ref={ref} width={320} height={80} className="mt-6" />;
}

function Gauge({ value, color }: { value: number; color: string }) {
  const angle = -90 + value * 180; // needle sweeps a semicircle
  return (
    <svg viewBox="0 0 200 110" className="w-56 mx-auto">
      <path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke="var(--line)" strokeWidth={10} />
      <path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${value * 283} 283`} opacity={0.85} />
      <motion.line x1={100} y1={100} x2={100} y2={25} stroke="var(--white)" strokeWidth={3}
        style={{ originX: "100px", originY: "100px" }}
        animate={{ rotate: angle }} transition={{ duration: 0.7, ease: "easeOut" }} />
      <circle cx={100} cy={100} r={6} fill="var(--white)" />
    </svg>
  );
}

export default function Chapter05Cockpit() {
  const [phase, setPhase] = useState<"idle" | "rec" | "busy">("idle");
  const [take, setTake] = useState<1 | 2>(1);
  const [result, setResult] = useState<MicResult | null>(null);
  const [err, setErr] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setErr("");
    setPhase("busy");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
      setResult(await r.json());
    } catch {
      setErr("scoring failed — is the backend up?");
    }
    setPhase("idle");
  };

  const record = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      const rec = new MediaRecorder(s);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
        setPhase("busy");
        const fd = new FormData();
        fd.append("file", new Blob(chunks, { type: rec.mimeType }), "take.webm");
        try {
          const r = await fetch(`${API}/api/mic/score?baseline=${take === 1 ? 1 : 0}`, { method: "POST", body: fd });
          const data = await r.json();
          setResult(data);
          if (take === 1 && data.baseline_captured) setTake(2);
        } catch {
          setErr("scoring failed — is the backend up?");
        }
        setPhase("idle");
      };
      rec.start();
      recRef.current = rec;
      setPhase("rec");
      setTimeout(() => rec.state === "recording" && rec.stop(), 5000);
    } catch {
      setErr("mic access denied");
    }
  };

  const gaugeColor = result ? labelColor(result.label) : "var(--dim)";

  return (
    <section id="ch-cockpit" className="min-h-screen flex flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-mono text-xs text-dim tracking-widest">05 · TRY THE COCKPIT</p>
      <MaskedHeading
        as="p" className="text-lg text-race-white/70 mt-3 max-w-xl font-sans normal-case"
        lines={["Read the card. First calm.", "Then like you just lost P6."]}
      />
      <p className="font-mono text-sm text-dim mt-4 max-w-xl">
        {take === 1 ? "“Understood, box this lap, box box.”"
          : "“I told you the tyres were gone three laps ago! Why are we ALWAYS last on strategy?!”"}
      </p>

      <motion.button
        onClick={phase === "rec" ? () => recRef.current?.stop() : record}
        disabled={phase === "busy"}
        data-cursor="play"
        whileTap={{ scale: 0.95 }}
        animate={phase === "rec" ? { scale: [1, 1.05, 1] } : {}}
        transition={phase === "rec" ? { repeat: Infinity, duration: 1 } : {}}
        className="mt-10 w-44 h-44 rounded-full border-2 flex items-center justify-center display text-xl"
        style={{ borderColor: phase === "rec" ? "var(--red)" : "var(--line)" }}
      >
        {phase === "rec" ? "STOP" : phase === "busy" ? "…" : "REC"}
      </motion.button>
      <LiveWaveform stream={stream} active={phase === "rec"} />

      <input
        ref={fileRef} type="file" accept="audio/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={phase === "busy"}
        className="font-mono text-xs text-dim hover:text-race-white underline underline-offset-4 mt-4"
      >
        or upload an audio clip →
      </button>

      {err && <p className="font-mono text-xs text-amber mt-4">{err}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="cut p-6 mt-8 w-full max-w-md text-left">
          {result.baseline_captured ? (
            <p className="font-mono text-xs text-race-green">✓ BASELINE CAPTURED — the system just learned what calm sounds like, for you specifically</p>
          ) : (
            <>
              <Gauge value={result.arousal} color={gaugeColor} />
              <div className="flex justify-between items-baseline mt-2">
                <span className="display text-2xl" style={{ color: gaugeColor }}>{result.label.toUpperCase()}</span>
                <span className="font-mono text-xs text-dim">
                  z {result.arousal_z > 0 ? "+" : ""}{result.arousal_z?.toFixed(1)} vs YOUR baseline
                </span>
              </div>
            </>
          )}
          {result.transcript && <p className="mt-4 text-sm">"{result.transcript}"</p>}
          <div className="mt-4 space-y-3">
            {result.alerts?.map((a, i) => <AlertCard key={i} alert={a} />)}
          </div>
        </motion.div>
      )}
    </section>
  );
}
