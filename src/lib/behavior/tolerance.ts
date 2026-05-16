import { FEATURE_KEYS, type FeatureVector } from "./features";

// Quantize each [0,1] feature into discrete buckets so values within
// ±BUCKET/2 of a bucket center round to the same code. Bucket size
// ≈ 0.15 (15% of range) gives ±~7.5% tolerance per dimension; chain it
// with a small "anchor" snap to widen the tolerance band a bit further.
const BUCKET = 0.15;

export function quantize(v: FeatureVector): Uint8Array {
  const out = new Uint8Array(FEATURE_KEYS.length);
  FEATURE_KEYS.forEach((k, i) => {
    const x = Math.max(0, Math.min(1, v[k]));
    out[i] = Math.round(x / BUCKET);
  });
  return out;
}

export function matchesTemplate(sample: FeatureVector, template: FeatureVector, tolerance = 0.15): boolean {
  let ok = 0;
  for (const k of FEATURE_KEYS) {
    if (Math.abs(sample[k] - template[k]) <= tolerance) ok++;
  }
  // require 70% of features within tolerance
  return ok / FEATURE_KEYS.length >= 0.7;
}
