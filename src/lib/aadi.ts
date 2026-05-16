// .aadi binary container.
// Layout:
//   0   4   magic "AADI"
//   4   2   version (u16 LE)
//   6   2   flags  (u16 LE, bit0 = isFile)
//   8  16   salt
//  24  12   IV
//  36   4   nameLen (u32 LE)
//  40   N   name (utf-8)
//  40+N 8   payloadLen (u64 LE — low/high u32)
//  ...  P   ciphertext
//  end-32 32 HMAC-SHA256 over all preceding bytes

export const AADI_MAGIC = new Uint8Array([0x41, 0x41, 0x44, 0x49]);
export const AADI_VERSION = 1;

export class AadiError extends Error {
  constructor(public code: "InvalidMagic" | "BadVersion" | "Truncated" | "HmacMismatch" | "DecryptFailed", msg: string) {
    super(msg);
  }
}

export type AadiHeader = {
  version: number;
  isFile: boolean;
  salt: Uint8Array;
  iv: Uint8Array;
  name: string;
  payloadLen: number;
};

export async function writeAadi(opts: {
  plaintext: Uint8Array;
  aesKey: CryptoKey;
  hmacKey: CryptoKey;
  salt: Uint8Array;
  iv: Uint8Array;
  name: string;
  isFile: boolean;
}): Promise<Uint8Array> {
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: opts.iv as BufferSource }, opts.aesKey, opts.plaintext as BufferSource);
  const ct = new Uint8Array(ctBuf);
  const nameBytes = new TextEncoder().encode(opts.name);
  const headerSize = 40 + nameBytes.length + 8;
  const total = headerSize + ct.length + 32;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  out.set(AADI_MAGIC, 0);
  dv.setUint16(4, AADI_VERSION, true);
  dv.setUint16(6, opts.isFile ? 1 : 0, true);
  out.set(opts.salt, 8);
  out.set(opts.iv, 24);
  dv.setUint32(36, nameBytes.length, true);
  out.set(nameBytes, 40);
  // u64 little-endian
  dv.setUint32(40 + nameBytes.length, ct.length >>> 0, true);
  dv.setUint32(40 + nameBytes.length + 4, Math.floor(ct.length / 2 ** 32), true);
  out.set(ct, headerSize);

  const mac = await crypto.subtle.sign("HMAC", opts.hmacKey, out.subarray(0, total - 32));
  out.set(new Uint8Array(mac), total - 32);
  return out;
}

export function parseHeader(buf: Uint8Array): AadiHeader & { ciphertextStart: number; ciphertextEnd: number; macStart: number } {
  if (buf.length < 40 + 8 + 32) throw new AadiError("Truncated", "File too small");
  for (let i = 0; i < 4; i++) if (buf[i] !== AADI_MAGIC[i]) throw new AadiError("InvalidMagic", "Not an .aadi file");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const version = dv.getUint16(4, true);
  if (version !== AADI_VERSION) throw new AadiError("BadVersion", `Unsupported version ${version}`);
  const flags = dv.getUint16(6, true);
  const salt = buf.slice(8, 24);
  const iv = buf.slice(24, 36);
  const nameLen = dv.getUint32(36, true);
  if (40 + nameLen + 8 + 32 > buf.length) throw new AadiError("Truncated", "Header truncated");
  const name = new TextDecoder().decode(buf.subarray(40, 40 + nameLen));
  const plLow = dv.getUint32(40 + nameLen, true);
  const plHigh = dv.getUint32(40 + nameLen + 4, true);
  const payloadLen = plHigh * 2 ** 32 + plLow;
  const ciphertextStart = 40 + nameLen + 8;
  const ciphertextEnd = ciphertextStart + payloadLen;
  const macStart = buf.length - 32;
  if (ciphertextEnd !== macStart) throw new AadiError("Truncated", "Payload length mismatch");
  return {
    version,
    isFile: (flags & 1) === 1,
    salt,
    iv,
    name,
    payloadLen,
    ciphertextStart,
    ciphertextEnd,
    macStart,
  };
}

export async function readAadi(
  buf: Uint8Array,
  aesKey: CryptoKey,
  hmacKey: CryptoKey,
): Promise<{ header: AadiHeader; plaintext: Uint8Array }> {
  const h = parseHeader(buf);
  const mac = buf.subarray(h.macStart);
  const ok = await crypto.subtle.verify("HMAC", hmacKey, mac as BufferSource, buf.subarray(0, h.macStart) as BufferSource);
  if (!ok) throw new AadiError("HmacMismatch", "HMAC verification failed");
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: h.iv as BufferSource },
      aesKey,
      buf.subarray(h.ciphertextStart, h.ciphertextEnd) as BufferSource,
    );
    return { header: h, plaintext: new Uint8Array(pt) };
  } catch {
    throw new AadiError("DecryptFailed", "Decryption failed");
  }
}
