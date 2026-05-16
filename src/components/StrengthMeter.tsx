import { cn } from "@/lib/utils";

export function StrengthMeter({ score, label }: { score: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 70 ? "bg-accent" : pct >= 40 ? "bg-primary" : "bg-destructive";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label ?? "Behavioral stability"}</span>
        <span className="font-mono text-foreground">{pct}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone)}
          style={{ width: `${pct}%`, boxShadow: pct >= 70 ? "var(--glow-accent)" : undefined }}
        />
      </div>
    </div>
  );
}
