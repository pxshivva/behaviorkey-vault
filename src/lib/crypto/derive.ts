import { quantize } from "@/lib/behavior/tolerance";
import type { FeatureVector } from "@/lib/behavior/features";

const PBKDF2_ITERS = 200_000;

export async function deriveSeed(features: FeatureVector): Promise<ArrayBuffer> {
  const q = quantize(features);
  return await crypto.subtle.digest("SHA-256", q);
}

async function importPbkdf2Base(seed: ArrayBuffer) {
  return crypto.subtle.importKey("raw", seed, { name: "PBKDF2" }, false, ["deriveBits"]);
}

export async function deriveAesAndHmac(
  features: FeatureVector,
  salt: Uint8Array,
): Promise<{ aesKey: CryptoKey; hmacKey: CryptoKey }> {
  const seed = await deriveSeed(features);
  const base = await importPbkdf2Base(seed);

  // 512 bits = 256 for AES + 256 for HMAC
  const combinedSalt = new Uint8Array(salt.length + 9);
  combinedSalt.set(salt, 0);
  combinedSalt.set(new TextEncoder().encode("aadi-v1.0"), salt.length);

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: combinedSalt as BufferSource, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    512,
  );
  const aesRaw = bits.slice(0, 32);
  const hmacRaw = bits.slice(32, 64);

  const aesKey = await crypto.subtle.importKey("raw", aesRaw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    hmacRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return { aesKey, hmacKey };
}

export function randomSalt(): Uint8Array {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return a;
}
export function randomIv(): Uint8Array {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return a;
}
