import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BehaviorPad } from "@/components/BehaviorPad";
import { StrengthMeter } from "@/components/StrengthMeter";
import { Button } from "@/components/ui/button";
import { extractFeatures, averageFeatures, type FeatureVector } from "@/lib/behavior/features";
import { stabilityScore } from "@/lib/behavior/stability";
import { randomSalt } from "@/lib/crypto/derive";
import { b64, saveEnrollment, loadEnrollment } from "@/lib/storage";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/enroll")({
  head: () => ({
    meta: [
      { title: "Enroll · BehaviorKey Vault" },
      { name: "description", content: "Record three behavioral samples to enroll your behavioral biometric template." },
    ],
  }),
  component: EnrollPage,
});

function EnrollPage() {
  const nav = useNavigate();
  const [samples, setSamples] = useState<FeatureVector[]>([]);
  const [existing, setExisting] = useState<boolean>(false);

  useEffect(() => {
    setExisting(!!loadEnrollment());
  }, []);

  const score = stabilityScore(samples);
  const step = samples.length;

  function handleCaptured(raw: ReturnType<typeof extractFeatures> extends never ? never : Parameters<typeof extractFeatures>[0]) {
    const f = extractFeatures(raw);
    setSamples((s) => [...s, f]);
  }

  function reset() {
    setSamples([]);
  }

  function complete() {
    if (samples.length < 3) return;
    if (score < 40) {
      toast.error("Stability too low — please redo your samples more consistently.");
      return;
    }
    const template = averageFeatures(samples);
    const salt = randomSalt();
    saveEnrollment({
      version: 1,
      saltB64: b64(salt),
      template,
      createdAt: Date.now(),
    });
    toast.success("Enrollment saved", { description: "Your behavioral template is stored locally." });
    nav({ to: "/encrypt" });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Enrollment <span className="text-muted-foreground font-normal text-base">· step {Math.min(step + 1, 3)} of 3</span></h1>
        <p className="text-sm text-muted-foreground">
          Record three samples by typing the phrase while moving your mouse naturally inside the pad. Be consistent — that's the key.
        </p>
      </header>

      {existing && samples.length === 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
          You already have an enrollment saved. Recording again will replace it.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 space-y-4">
        {step < 3 ? (
          <BehaviorPad onCaptured={handleCaptured} label={`Sample ${step + 1} of 3`} minDurationMs={4000} />
        ) : (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <div className="font-semibold">3 samples captured</div>
            <div className="text-sm text-muted-foreground">Review stability below, then continue.</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <StrengthMeter score={score} />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`rounded-md border px-3 py-2 text-xs ${
                i < samples.length ? "border-accent/50 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              Sample {i + 1} {i < samples.length ? "✓" : "—"}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={reset} disabled={samples.length === 0}>
            <RotateCcw className="mr-1 h-4 w-4" /> Restart
          </Button>
          <Button onClick={complete} disabled={samples.length < 3} className="gradient-primary text-primary-foreground">
            Save template & continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
