import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SampleRecorder, type RawSample } from "@/lib/behavior/capture";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export const DUMMY_PHRASE = "the quick brown fox jumps over the lazy dog";

export function BehaviorPad({
  onCaptured,
  label = "Behavioral sample",
  minDurationMs = 4000,
  autoStop,
}: {
  onCaptured: (sample: RawSample) => void;
  label?: string;
  minDurationMs?: number;
  autoStop?: number;
}) {
  const recRef = useRef(new SampleRecorder());
  const mouseRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState("");
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 100);
      const pts = recRef.current.liveMouse();
      setTrail(pts.slice(-60).map((p) => {
        const r = mouseRef.current!.getBoundingClientRect();
        return { x: p.x - r.left, y: p.y - r.top };
      }));
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && autoStop && elapsed >= autoStop) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, running, autoStop]);

  function start() {
    if (!mouseRef.current || !inputRef.current) return;
    setTyped("");
    setElapsed(0);
    setTrail([]);
    recRef.current.start(mouseRef.current, inputRef.current);
    setRunning(true);
    inputRef.current.focus();
  }
  function stop() {
    const s = recRef.current.stop();
    setRunning(false);
    onCaptured(s);
  }

  const phraseProgress = Math.min(1, typed.length / DUMMY_PHRASE.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-sm text-foreground/80 font-mono">
            type: <span className="text-accent">{DUMMY_PHRASE}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{(elapsed / 1000).toFixed(1)}s</span>
          {!running ? (
            <Button size="sm" onClick={start} className="gradient-primary text-primary-foreground">
              <Mic className="mr-1 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={stop} disabled={elapsed < minDurationMs}>
              {elapsed < minDurationMs ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Square className="mr-1 h-4 w-4" />}
              Stop
            </Button>
          )}
        </div>
      </div>

      <div
        ref={mouseRef}
        className={cn(
          "relative h-56 w-full rounded-lg border bg-card/60 overflow-hidden",
          running && "ring-1 ring-primary/60",
        )}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <polyline
            points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="oklch(0.78 0.16 200 / 0.7)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">
            {running ? "Move your mouse here while typing →" : "Press Start to begin"}
          </span>
        </div>
      </div>

      <textarea
        ref={inputRef}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={!running}
        placeholder={running ? "Type the phrase…" : "—"}
        className="w-full h-20 rounded-lg border bg-input/40 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
      />
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full gradient-primary transition-[width] duration-200" style={{ width: `${phraseProgress * 100}%` }} />
      </div>
    </div>
  );
}
