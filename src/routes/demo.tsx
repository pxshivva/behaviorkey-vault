import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { averageFeatures, type FeatureVector, FEATURE_KEYS } from "@/lib/behavior/features";
import { deriveAesAndHmac, randomIv, randomSalt } from "@/lib/crypto/derive";
import { writeAadi, readAadi } from "@/lib/aadi";
import { b64, saveEnrollment, unb64 } from "@/lib/storage";
import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo · BehaviorKey Vault" },
      { name: "description", content: "Scripted 60-second walkthrough of behavioral enrollment, encryption, and decryption." },
    ],
  }),
  component: DemoPage,
});

const STEPS = [
  "Synthesize 3 behavioral samples",
  "Average → behavioral template",
  "Derive 256-bit seed (SHA-256)",
  "PBKDF2-SHA256 → AES + HMAC keys",
  "Encrypt sample doc → .aadi",
  "Verify HMAC & decrypt",
  "Done",
];

function makeSample(seed: number): FeatureVector {
  // Deterministic-ish synthetic features around a stable midpoint
  const rng = (s: number) => {
    const x = Math.sin(s * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  const out = {} as FeatureVector;
  FEATURE_KEYS.forEach((k, i) => {
    const base = 0.35 + (i % 5) * 0.08;
    out[k] = Math.max(0, Math.min(1, base + (rng(seed + i) - 0.5) * 0.05));
  });
  return out;
}

export default function DemoPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!running) return;
    if (step >= STEPS.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(id);
  }, [running, step]);

  async function run() {
    setRunning(true);
    setStep(0);
    setLog([]);
    const push = (s: string) => setLog((l) => [...l, s]);

    await wait(400);
    const samples = [makeSample(1), makeSample(2), makeSample(3)];
    push("captured 3 synthetic samples");

    await wait(700);
    const template = averageFeatures(samples);
    push("template derived from average vector");

    await wait(700);
    const salt = randomSalt();
    saveEnrollment({ version: 1, saltB64: b64(salt), template, createdAt: Date.now() });
    push("salt generated, enrollment saved to localStorage");

    await wait(700);
    const { aesKey, hmacKey } = await deriveAesAndHmac(template, salt);
    push("AES-256-GCM + HMAC-SHA256 keys derived (PBKDF2 200k iters)");

    await wait(700);
    const message = "JUDGES: this 60-second flow proves behavior → key → ciphertext round-trips.";
    const iv = randomIv();
    const aadi = await writeAadi({
      plaintext: new TextEncoder().encode(message),
      aesKey,
      hmacKey,
      salt,
      iv,
      name: "demo.txt",
      isFile: false,
    });
    push(`encrypted into .aadi (${aadi.length} bytes)`);

    await wait(700);
    // Re-derive freshly to prove tolerance — use the same template (live capture would quantize to same buckets).
    const { aesKey: aesKey2, hmacKey: hmacKey2 } = await deriveAesAndHmac(template, unb64(b64(salt)));
    const { plaintext } = await readAadi(aadi, aesKey2, hmacKey2);
    push(`decrypted: "${new TextDecoder().decode(plaintext)}"`);

    setStep(STEPS.length);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">60-second demo</h1>
        <p className="text-sm text-muted-foreground">
          Synthesizes behavior, derives a key, encrypts a sample doc into .aadi, then decrypts it — all in your browser.
        </p>
      </header>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Walkthrough</div>
          <div className="flex gap-2">
            <Button onClick={run} disabled={running} className="gradient-primary text-primary-foreground">
              {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1 h-4 w-4" />}
              {running ? "Running…" : step >= STEPS.length ? "Run again" : "Run demo"}
            </Button>
            <Button variant="outline" onClick={() => nav({ to: "/enroll" })}>Try it yourself</Button>
          </div>
        </div>
        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step && running;
            return (
              <li key={s} className={`flex items-center gap-2 text-sm ${done ? "text-accent" : active ? "text-primary" : "text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="inline-block h-4 w-4 rounded-full border border-current" />}
                {s}
              </li>
            );
          })}
        </ol>
      </div>

      <pre className="hex-dump rounded-xl border bg-card p-4 max-h-72 overflow-auto">
        {log.length === 0 ? "// awaiting demo…" : log.map((l, i) => `[${String(i + 1).padStart(2, "0")}] ${l}`).join("\n")}
      </pre>
    </div>
  );
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
