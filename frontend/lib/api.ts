// Typed client for the frozen contracts (FINAL-SOLUTION B2/B3).
export const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

export type Prosody = { rate_sps: number; pause_ratio: number; f0_var: number };

export type ClipScore = {
  clip_id: string;
  t_session_s: number;
  lap: number | null;
  audio_url: string;
  duration_s: number;
  transcript: string;
  asr_conf: number;
  asr_model: string;
  word_confs: [string, number][];
  arousal: number;
  valence: number;
  arousal_z: number;
  valence_z: number;
  cat_emotion: Record<string, number>;
  prosody: Prosody;
  text_emotion: Record<string, number>;
  label: "calm" | "stressed" | "tired" | "uncertain";
  confidence: number;
  signals_agree: boolean;
};

export type TracePoint = {
  t: number;
  mean: [number, number];
  std: [number, number];
  p_change: number;
  regime_id: number;
};

export type Alert = {
  type: "fatigue_drift" | "red_mist";
  t_start: number;
  t_end: number | null;
  laps: number[];
  evidence: Record<string, number>;
  confidence: number;
  message: string;
};

export type LapPoint = {
  lap: number;
  lap_time_s: number | null;
  t_start_s: number;
  is_pit: boolean;
};

export type SessionMeta = {
  key: string;
  year: number;
  gp: string;
  session: string;
  driver: string;
  driver_number?: number;
  clip_count: number;
  ready: boolean;
};

export type Trace = {
  engine: string;
  trace: TracePoint[];
  alerts: Alert[];
  laps: LapPoint[];
};

const j = (r: Response) => {
  if (!r.ok) throw new Error(`${r.url}: ${r.status}`);
  return r.json();
};

export const getSessions = (): Promise<SessionMeta[]> =>
  fetch(`${API}/api/sessions`).then(j);
export const getClips = (key: string): Promise<ClipScore[]> =>
  fetch(`${API}/api/sessions/${key}/clips`).then(j);
export const getTrace = (key: string, engine: string): Promise<Trace> =>
  fetch(`${API}/api/sessions/${key}/trace?engine=${engine}`).then(j);
export const getWrapped = (key: string, drv: string) =>
  fetch(`${API}/api/sessions/${key}/wrapped/${drv}`).then(j);

export const labelColor = (label: string) =>
  label === "stressed" ? "var(--red)"
  : label === "tired" ? "var(--amber)"
  : label === "uncertain" ? "var(--dim)"
  : "var(--green)";

export const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
};
