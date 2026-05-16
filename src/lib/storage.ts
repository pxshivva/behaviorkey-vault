import type { FeatureVector } from "@/lib/behavior/features";

const KEY = "bkv.enrollment.v1";

export type Enrollment = {
  version: 1;
  saltB64: string;
  template: FeatureVector;
  createdAt: number;
};

export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function saveEnrollment(e: Enrollment) {
  localStorage.setItem(KEY, JSON.stringify(e));
}
export function loadEnrollment(): Enrollment | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Enrollment; } catch { return null; }
}
export function clearEnrollment() { localStorage.removeItem(KEY); }
