import type { RawSample } from "./capture";

// Feature vector schema — fixed order, all normalized to [0,1].
export const FEATURE_KEYS = [
  "meanInterKey",      // ms between keydowns
  "stdInterKey",
  "meanDwell",         // keydown→keyup
  "meanFlight",        // keyup→next keydown
  "meanVelocity",      // px/ms
  "varVelocity",
  "jitter",            // mean |Δvelocity|
  "curvature",         // mean turning angle (rad)
  "dirChangeRate",     // direction changes per second
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureVector = Record<FeatureKey, number>;

// Per-feature clamp ranges (raw → normalized via clamp).
const RANGES: Record<FeatureKey, [number, number]> = {
  meanInterKey:  [40, 600],
  stdInterKey:   [0, 400],
  meanDwell:     [20, 250],
  meanFlight:    [0, 500],
  meanVelocity:  [0, 3],
  varVelocity:   [0, 5],
  jitter:        [0, 2],
  curvature:     [0, 1.6],
  dirChangeRate: [0, 20],
};

function clamp01(v: number, lo: number, hi: number) {
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

function mean(a: number[]) {
  if (!a.length) return 0;
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}
function variance(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  let s = 0;
  for (const v of a) s += (v - m) ** 2;
  return s / a.length;
}
function std(a: number[]) { return Math.sqrt(variance(a)); }

export function extractFeatures(sample: RawSample): FeatureVector {
  // Typing
  const downs = sample.keys.filter((k) => k.type === "down");
  const ups = sample.keys.filter((k) => k.type === "up");
  const inter: number[] = [];
  for (let i = 1; i < downs.length; i++) inter.push(downs[i].t - downs[i - 1].t);

  const dwells: number[] = [];
  for (const d of downs) {
    const u = ups.find((u) => u.key === d.key && u.t > d.t);
    if (u) dwells.push(u.t - d.t);
  }
  const flights: number[] = [];
  for (let i = 0; i < downs.length - 1; i++) {
    const u = ups.find((u) => u.key === downs[i].key && u.t > downs[i].t);
    if (u && downs[i + 1].t > u.t) flights.push(downs[i + 1].t - u.t);
  }

  // Mouse
  const pts = sample.mouse;
  const velocities: number[] = [];
  const angles: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const dt = Math.max(1, pts[i].t - pts[i - 1].t);
    velocities.push(Math.hypot(dx, dy) / dt);
    angles.push(Math.atan2(dy, dx));
  }
  const jitterVals: number[] = [];
  for (let i = 1; i < velocities.length; i++) jitterVals.push(Math.abs(velocities[i] - velocities[i - 1]));

  const turningAngles: number[] = [];
  let dirChanges = 0;
  for (let i = 1; i < angles.length; i++) {
    let d = Math.abs(angles[i] - angles[i - 1]);
    if (d > Math.PI) d = 2 * Math.PI - d;
    turningAngles.push(d);
    if (d > Math.PI / 4) dirChanges++;
  }
  const durSec = Math.max(0.5, (sample.endedAt - sample.startedAt) / 1000);

  const raw = {
    meanInterKey: mean(inter),
    stdInterKey: std(inter),
    meanDwell: mean(dwells),
    meanFlight: mean(flights),
    meanVelocity: mean(velocities),
    varVelocity: variance(velocities),
    jitter: mean(jitterVals),
    curvature: mean(turningAngles),
    dirChangeRate: dirChanges / durSec,
  };

  const out = {} as FeatureVector;
  for (const k of FEATURE_KEYS) {
    const [lo, hi] = RANGES[k];
    out[k] = clamp01(raw[k], lo, hi);
  }
  return out;
}

export function averageFeatures(samples: FeatureVector[]): FeatureVector {
  const out = {} as FeatureVector;
  for (const k of FEATURE_KEYS) out[k] = mean(samples.map((s) => s[k]));
  return out;
}

export function featuresToFloat32(v: FeatureVector): Float32Array {
  const a = new Float32Array(FEATURE_KEYS.length);
  FEATURE_KEYS.forEach((k, i) => (a[i] = v[k]));
  return a;
}
