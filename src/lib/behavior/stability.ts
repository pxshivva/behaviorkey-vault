import { FEATURE_KEYS, type FeatureVector } from "./features";

/** 0–100 stability score across samples. Higher = more consistent. */
export function stabilityScore(samples: FeatureVector[]): number {
  if (samples.length < 2) return 0;
  let totalCv = 0;
  let count = 0;
  for (const k of FEATURE_KEYS) {
    const vals = samples.map((s) => s[k]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (m < 0.02) continue;
    const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length;
    const cv = Math.sqrt(variance) / m;
    totalCv += cv;
    count++;
  }
  if (!count) return 0;
  const avgCv = totalCv / count;
  // map cv: 0 → 100, 0.6+ → 0
  return Math.max(0, Math.min(100, Math.round(100 * (1 - avgCv / 0.6))));
}
