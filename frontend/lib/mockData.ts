// Offline-safe placeholder data, shaped identically to the live API contracts
// (lib/api.ts). Used only when the backend fetch fails, so the cinema never breaks.
import { Alert, ClipScore, LapPoint, Prosody, SessionMeta, TracePoint, Trace } from "./api";

export const MOCK_SESSIONS: SessionMeta[] = [
  { key: "2023_qatar_R_OCO", year: 2023, gp: "qatar", session: "R", driver: "OCO", driver_number: 31, clip_count: 18, ready: true },
  { key: "2024_singapore_R_NOR", year: 2024, gp: "singapore", session: "R", driver: "NOR", driver_number: 4, clip_count: 21, ready: true },
];

const P = (rate: number, pause: number, f0: number): Prosody => ({ rate_sps: rate, pause_ratio: pause, f0_var: f0 });

const STORY_BEATS: ClipScore[] = [
  { clip_id: "c1", t_session_s: 120, lap: 4, audio_url: "", duration_s: 3.2, transcript: "okay radio check, all good", asr_conf: 0.9, asr_model: "distil", word_confs: [], arousal: 0.42, valence: 0.6, arousal_z: -0.2, valence_z: 0.4, cat_emotion: { neutral: 0.8 }, prosody: P(3.8, 0.2, 400), text_emotion: { neutral: 0.9 }, label: "calm", confidence: 0.8, signals_agree: true },
  { clip_id: "c2", t_session_s: 1560, lap: 15, audio_url: "", duration_s: 4.1, transcript: "I just vomited, I'm telling you, in the helmet", asr_conf: 0.81, asr_model: "atc", word_confs: [], arousal: 0.78, valence: 0.25, arousal_z: 1.9, valence_z: -1.4, cat_emotion: { disgusted: 0.4, sad: 0.3 }, prosody: P(5.4, 0.3, 900), text_emotion: { disgust: 0.5, fear: 0.3 }, label: "stressed", confidence: 0.77, signals_agree: true },
  { clip_id: "c3", t_session_s: 2880, lap: 25, audio_url: "", duration_s: 5.8, transcript: "why are we ALWAYS last to react?! I told you the tyres were gone three laps ago!", asr_conf: 0.85, asr_model: "distil", word_confs: [], arousal: 0.85, valence: 0.15, arousal_z: 2.3, valence_z: -1.8, cat_emotion: { angry: 0.65 }, prosody: P(5.8, 0.1, 1100), text_emotion: { anger: 0.7 }, label: "stressed", confidence: 0.9, signals_agree: true },
  { clip_id: "c4", t_session_s: 5160, lap: 41, audio_url: "", duration_s: 2.9, transcript: "how many laps... how many laps left", asr_conf: 0.6, asr_model: "atc", word_confs: [], arousal: 0.25, valence: 0.4, arousal_z: -1.8, valence_z: -0.5, cat_emotion: { sad: 0.5 }, prosody: P(2.8, 0.4, 300), text_emotion: { sadness: 0.5 }, label: "tired", confidence: 0.7, signals_agree: true },
  { clip_id: "c5", t_session_s: 6600, lap: 57, audio_url: "", duration_s: 4.4, transcript: "P7 mate, honestly one of the hardest races of my life", asr_conf: 0.88, asr_model: "distil", word_confs: [], arousal: 0.55, valence: 0.7, arousal_z: 0.3, valence_z: 1.1, cat_emotion: { happy: 0.5 }, prosody: P(4.4, 0.2, 500), text_emotion: { joy: 0.6 }, label: "calm", confidence: 0.85, signals_agree: true },
];

const FILLER_LINES: Record<ClipScore["label"], string[]> = {
  calm: ["copy that, box this lap", "understood, keeping the delta", "gap behind is two seconds"],
  stressed: ["confirm push push push, losing time", "we need to react, come on", "this isn't working, come on"],
  tired: ["yeah... copy that", "how much longer", "just talk to me"],
  elevated: ["okay okay copy that", "yeah we're on it", "understood, pushing now"],
  uncertain: ["...", "copy", "yeah"],
};

function labelFor(a: number): ClipScore["label"] {
  return a > 0.65 ? "stressed" : a < 0.35 ? "tired" : "calm";
}

// interleave 2-3 synthesized filler clips between each authored story beat so the
// rail reads like a real ~18-clip session even fully offline.
export const MOCK_CLIPS: ClipScore[] = STORY_BEATS.flatMap((beat, i) => {
  const next = STORY_BEATS[i + 1];
  if (!next) return [beat];
  const fillers = Array.from({ length: 3 }, (_, j) => {
    const frac = (j + 1) / 4;
    const t = beat.t_session_s + (next.t_session_s - beat.t_session_s) * frac;
    const arousal = beat.arousal + (next.arousal - beat.arousal) * frac + (Math.sin(t) * 0.06);
    const label = labelFor(arousal);
    const lines = FILLER_LINES[label];
    return {
      ...beat, clip_id: `${beat.clip_id}f${j}`, t_session_s: Math.round(t),
      lap: Math.round((beat.lap ?? 0) + ((next.lap ?? 0) - (beat.lap ?? 0)) * frac),
      transcript: lines[j % lines.length],
      duration_s: 2 + Math.abs(Math.sin(t)) * 2,
      arousal: Math.max(0.1, Math.min(0.9, arousal)),
      arousal_z: (arousal - 0.5) * 4,
      cat_emotion: { neutral: 0.9 }, text_emotion: { neutral: 0.9 },
      label, confidence: 0.6, signals_agree: false,
    };
  });
  return [beat, ...fillers];
});

export const MOCK_LAPS: LapPoint[] = Array.from({ length: 57 }, (_, i) => ({
  lap: i + 1,
  lap_time_s: 92 + (i + 1 >= 38 && i + 1 <= 50 ? 0.55 : 0) + (i === 26 ? 14 : 0) + Math.sin(i) * 0.3,
  t_start_s: i * 92.5,
  is_pit: i + 1 === 27,
}));

export const MOCK_TRACE: TracePoint[] = Array.from({ length: 120 }, (_, i) => {
  const t = i * 55;
  const drift = Math.sin(i / 14) * 0.25 + (i > 70 && i < 95 ? -0.25 : 0);
  const mean = 0.5 + drift;
  const std = 0.06 + 0.05 * Math.abs(Math.sin(i / 6));
  return { t, mean: [mean, 0.5 - drift * 0.4] as [number, number], std: [std, std] as [number, number], p_change: i % 23 === 0 ? 0.9 : 0, regime_id: Math.floor(i / 23) };
});

export const MOCK_ALERTS: Alert[] = [
  { type: "red_mist", t_start: 2880, t_end: null, laps: [25], evidence: { arousal_z: 2.3, anger: 0.7, rate_sps: 5.8 }, confidence: 0.9, message: "Frustration spike — cool-down call recommended" },
  { type: "fatigue_drift", t_start: 5040, t_end: 5280, laps: [40, 44], evidence: { arousal_z: -1.5, sustained_clips: 3, lap_delta_s: 0.5 }, confidence: 0.83, message: "Sustained low-arousal drift coinciding with lap-time loss" },
];

export const MOCK_TRACE_RESULT: Trace = { engine: "bayes", trace: MOCK_TRACE, alerts: MOCK_ALERTS, laps: MOCK_LAPS };

export const MOCK_WRAPPED = {
  driver: "OCO",
  session: MOCK_SESSIONS[0],
  clip_count: 23,
  pct_calm: 52,
  pct_stressed: 30,
  pct_tired: 18,
  spiciest_clip: { transcript: "why are we ALWAYS last to react?!", arousal_z: 2.3, lap: 25 },
  avg_confidence: 0.79,
  peak_stress_lap: 41,
  composure: 71,
};
