# BehaviorKey Vault — MVP Plan

A fully browser-based React app that derives AES-256-GCM keys from a user's mouse + typing behavior, then encrypts/decrypts arbitrary files into a custom `.aadi` container. No backend.

## Routes (TanStack Start)

```
src/routes/
  __root.tsx          shell + nav + theme
  index.tsx           landing / hero + "Start demo" CTA
  enroll.tsx          3-sample behavioral enrollment
  encrypt.tsx         pick text/file → produce .aadi
  decrypt.tsx         upload .aadi → re-sample → reveal
  demo.tsx            scripted 60s walkthrough
```

Shared `OnboardingStepper` in `__root.tsx` shows progress across enroll → encrypt → decrypt.

## Behavioral capture (`src/lib/behavior/`)

- `capture.ts` — attaches `mousemove` + `keydown`/`keyup` listeners; records timestamped samples.
- `features.ts` — extracts a fixed-length feature vector:
  - typing: mean inter-key interval, std-dev, dwell time, flight time
  - mouse: mean velocity, velocity variance, jitter (high-freq deltas), mean curvature of path, direction-change rate
  - all values normalized to [0,1] using clamp ranges
- `stability.ts` — given N samples, returns coefficient-of-variation per feature → "strength meter" 0–100. Enrollment requires score ≥ threshold; otherwise prompts re-sample.
- `tolerance.ts` — `matchesTemplate(sample, template, ±15%)` for decrypt-time gating, plus a "quantized" rounding step that snaps each feature into discrete buckets so small variance produces the *same* derived key bytes.

## Key derivation (`src/lib/crypto/`)

- `deriveKey.ts`:
  1. Quantize feature vector with ±15% tolerance buckets.
  2. SHA-256 the quantized bytes → 256-bit seed.
  3. PBKDF2-SHA256(seed, salt, 200k iters, 256 bits) via Web Crypto.
  4. Import as AES-GCM `CryptoKey`.
- `aesgcm.ts` — encrypt/decrypt with random 12-byte IV.
- `hmac.ts` — HMAC-SHA256 over header+ciphertext using a key split off the same PBKDF2 stream (separate `info` salt).

## .aadi file format (`src/lib/aadi.ts`)

Binary layout written with `DataView` over `ArrayBuffer`:

```
offset  size   field
0       4      magic "AADI" (0x41 41 44 49)
4       2      version (uint16, =1)
6       2      flags  (uint16; bit0 = isFile)
8       16     salt
24      12     IV
36      4      originalNameLen (uint32)
40      N      originalName (utf-8)
40+N    8      payloadLen (uint64)
…       P      ciphertext
end-32  32     HMAC-SHA256
```

`writeAadi(plaintext, key, hmacKey, meta)` and `readAadi(buf)` with strict validation + typed errors (`InvalidMagic`, `BadVersion`, `HmacMismatch`, `DecryptFailed`).

## UI surfaces

- **Enroll** — 3 cards (Sample 1/2/3). Each card has:
  - typing pad with a fixed dummy phrase ("the quick brown fox jumps over the lazy dog")
  - mouse trail area
  - live strength meter (Radix Progress)
  - "Retake" / "Next"
- On finish: persist `{ salt, template, version }` to `localStorage` under `bkv.enrollment.v1`. Never store the key.
- **Encrypt** — tabbed "Text" / "File"; drop zone; live status; downloads `<name>.aadi`. Below shows a **hex-dump diff** (plaintext bytes vs encrypted bytes, monospaced, first 256 bytes).
- **Decrypt** — drop `.aadi`; show parsed header card; user does a quick sample (single pad); on success reveal text or trigger file download. Clear error states for HMAC mismatch / wrong behavior.
- **Live fingerprint canvas** (`components/FingerprintCanvas.tsx`) — fixed bar in the header. Maintains a ring buffer of mouse velocity; renders a symmetric voiceprint-style waveform via `requestAnimationFrame` on a `<canvas>`. Idle state = gentle sine.
- **Demo mode** (`/demo`) — scripted state machine that auto-fills enrollment with simulated events, encrypts a sample doc, then decrypts it, narrated by an overlay with step labels. 60s total.

## Design system

Update `src/styles.css` tokens (dark default):
- `--background` deep gray, `--card` slightly lifted, `--primary` purple, `--accent` cyan, plus `--gradient-primary`, `--glow-primary`, `--shadow-elegant`.
- Add reusable utility classes: `.glow-primary`, `.hex-dump`, `.waveform-frame`.
- Use existing shadcn primitives (Card, Tabs, Progress, Button, Dialog, Sonner toasts).

## Components

```
src/components/
  FingerprintCanvas.tsx
  StrengthMeter.tsx
  HexDumpDiff.tsx
  OnboardingStepper.tsx
  SampleRecorder.tsx       (typing pad + mouse area + capture lifecycle)
  AadiHeaderCard.tsx
  DemoOverlay.tsx
  ErrorState.tsx
```

## Error / loading states

- Web Crypto unavailable → blocking screen with explanation.
- Enrollment stability too low → inline warning + retake.
- Decrypt: distinct messages for `InvalidMagic`, `HmacMismatch` ("file tampered or wrong key"), `DecryptFailed` ("behavior didn't match closely enough — try again, relax").
- All async actions show spinners; toasts via `sonner` for success/failure.

## Out of scope (MVP)

- No multi-user accounts, no cloud sync, no key rotation UI.
- No mobile touch behavioral capture (desktop pointer + keyboard only; small notice on mobile).

## Technical notes

- Pure browser; uses `window.crypto.subtle` everywhere — guard SSR by gating crypto code behind `useEffect` / dynamic checks. Route components stay client-rendered; no server functions needed.
- `.aadi` reading uses `file.arrayBuffer()`; writing uses `Blob` + `URL.createObjectURL`.
- Quantization bucket width per feature = 15% of its clamp range, ensuring ±15% variance yields the same seed deterministically.
- HMAC key derived via a second PBKDF2 pass with a fixed `"aadi-hmac"` info-salt suffix so both sides recompute identically.
- All Web Crypto calls wrapped with typed error classes; no `any`.
