import { useState } from "react";
import { FEATURE_KEYS, type FeatureVector, type FeatureKey } from "@/lib/behavior/features";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, X, Copy, Download, ChevronDown, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BUCKET = 0.15;
const TOL = 0.15;

const LABELS: Record<FeatureKey, string> = {
  meanInterKey: "Inter-key timing",
  stdInterKey: "Typing rhythm variance",
  meanDwell: "Key dwell time",
  meanFlight: "Key flight time",
  meanVelocity: "Mouse velocity",
  varVelocity: "Velocity variance",
  jitter: "Mouse jitter",
  curvature: "Path curvature",
  dirChangeRate: "Direction changes",
};

export type FeatureDelta = {
  key: FeatureKey;
  label: string;
  sample: number;
  template: number;
  delta: number;
  pctOfTol: number; // 0..>1 — 1.0 = exactly at tolerance edge
  sampleBucket: number;
  templateBucket: number;
  passed: boolean;
};

export function computeDeltas(sample: FeatureVector, template: FeatureVector): FeatureDelta[] {
  return FEATURE_KEYS.map((k) => {
    const s = sample[k];
    const t = template[k];
    const delta = Math.abs(s - t);
    return {
      key: k,
      label: LABELS[k],
      sample: s,
      template: t,
      delta,
      pctOfTol: delta / TOL,
      sampleBucket: Math.round(s / BUCKET),
      templateBucket: Math.round(t / BUCKET),
      passed: delta <= TOL,
    };
  });
}

export function ToleranceReport({
  sample,
  template,
  onRetry,
}: {
  sample: FeatureVector;
  template: FeatureVector;
  onRetry?: () => void;
}) {
  const deltas = computeDeltas(sample, template);
  const failed = deltas.filter((d) => !d.passed);
  const passed = deltas.length - failed.length;
  const matchPct = Math.round((passed / deltas.length) * 100);

  const report = {
    schema: "behaviorkey-vault.tolerance-report/v1",
    generatedAt: new Date().toISOString(),
    tolerance: TOL,
    bucketWidth: BUCKET,
    requiredMatchRatio: 0.7,
    overall: {
      featuresTotal: deltas.length,
      featuresPassed: passed,
      featuresFailed: failed.length,
      matchPct,
      decision: matchPct >= 70 ? "pass" : "fail",
    },
    features: deltas.map((d) => ({
      key: d.key,
      label: d.label,
      sample: Number(d.sample.toFixed(6)),
      template: Number(d.template.toFixed(6)),
      delta: Number(d.delta.toFixed(6)),
      pctOfTolerance: Number(d.pctOfTol.toFixed(4)),
      sampleBucket: d.sampleBucket,
      templateBucket: d.templateBucket,
      passed: d.passed,
    })),
  };
  const json = JSON.stringify(report, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Copied breakdown to clipboard");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }
  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tolerance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Behavior didn't match closely enough</h3>
          <p className="text-sm text-muted-foreground">
            {failed.length} of {deltas.length} features fell outside the ±15% tolerance.
            Overall match: <span className="font-mono text-foreground">{matchPct}%</span> (need ≥70%).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy JSON
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {deltas.map((d) => (
          <DeltaRow key={d.key} d={d} />
        ))}
      </div>

      <div className="text-xs text-muted-foreground border-t border-border/50 pt-3">
        Tip: Each feature is quantized into buckets of width {BUCKET}. Sample and template must land in the
        same (or adjacent) bucket. Re-sample with the same posture, hand position, and rhythm as enrollment.
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-accent hover:underline font-medium"
        >
          Try again →
        </button>
      )}
    </div>
  );
}

function DeltaRow({ d }: { d: FeatureDelta }) {
  // Visualize how far we drifted relative to tolerance window (cap bar at 200%)
  const barPct = Math.min(100, (d.pctOfTol / 2) * 100);
  const tone = d.passed ? "bg-accent" : "bg-destructive";
  const samplePos = Math.max(0, Math.min(100, d.sample * 100));
  const templatePos = Math.max(0, Math.min(100, d.template * 100));

  return (
    <div className="rounded-md border bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {d.passed ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <X className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="font-medium text-foreground">{d.label}</span>
          <span className="text-muted-foreground font-mono">({d.key})</span>
        </div>
        <span className={cn("font-mono", d.passed ? "text-accent" : "text-destructive")}>
          Δ {d.delta.toFixed(3)} / {TOL.toFixed(2)} ({Math.round(d.pctOfTol * 100)}%)
        </span>
      </div>

      {/* Number-line: template vs sample positions */}
      <div className="relative h-6 rounded-sm bg-muted/60 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/70"
          style={{ left: `${templatePos}%` }}
          title={`template: ${d.template.toFixed(3)}`}
        />
        <div
          className={cn("absolute top-1 bottom-1 w-1 rounded-sm", d.passed ? "bg-accent" : "bg-destructive")}
          style={{ left: `calc(${samplePos}% - 2px)` }}
          title={`sample: ${d.sample.toFixed(3)}`}
        />
        {/* tolerance band around template */}
        <div
          className="absolute top-0 bottom-0 bg-foreground/10"
          style={{
            left: `${Math.max(0, templatePos - TOL * 100)}%`,
            width: `${Math.min(100, TOL * 200)}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>template {d.template.toFixed(3)} · bucket #{d.templateBucket}</span>
        <div className="flex-1 mx-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full", tone)} style={{ width: `${barPct}%` }} />
        </div>
        <span>sample {d.sample.toFixed(3)} · bucket #{d.sampleBucket}</span>
      </div>
    </div>
  );
}
