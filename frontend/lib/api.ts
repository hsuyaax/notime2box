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
  label: "calm" | "stressed" | "tired" | "elevated" | "uncertain";
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

export type RaceOption = {
  gp_slug: string; country_name: string; circuit_short_name: string;
  session_key: number; date_start: string;
};
export type DriverOption = { acronym: string; full_name: string; team_name: string; driver_number: number };

export const getRaces = (year: number): Promise<RaceOption[]> =>
  fetch(`${API}/api/catalog/${year}`).then(j);
export const getDrivers = (year: number, sessionKey: number): Promise<DriverOption[]> =>
  fetch(`${API}/api/catalog/${year}/drivers?session_key=${sessionKey}`).then(j);
export const getClips = (key: string): Promise<ClipScore[]> =>
  fetch(`${API}/api/sessions/${key}/clips`).then(j);
export const getTrace = (key: string, engine: string): Promise<Trace> =>
  fetch(`${API}/api/sessions/${key}/trace?engine=${engine}`).then(j);
export const getWrapped = (key: string, drv: string) =>
  fetch(`${API}/api/sessions/${key}/wrapped/${drv}`).then(j);

export const labelColor = (label: string) =>
  label === "stressed" ? "var(--red)"
  : label === "tired" ? "var(--amber)"
  // elevated = clearly above this driver's normal but NOT negative (excited, not
  // stressed). Amber, because it's worth a glance, never red — see _label().
  : label === "elevated" ? "var(--amber)"
  : label === "uncertain" ? "var(--dim)"
  : "var(--green)";

/** Clip audio is served from our own backend (the F1 CDN sends no CORS header),
 *  so relative paths need the API host prefixed. */
export const audioSrc = (u: string) => (u.startsWith("/") ? `${API}${u}` : u);

export const fmtT = (s: number): string => {
  // pre-session grid radio has negative t_session_s (before lights out) — real data
  if (s < 0) return `-${fmtT(-s)}`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
};
