import { useEffect, useRef } from "react";

/** Global live-waveform fingerprint — listens to window mousemove. */
export function FingerprintCanvas({ height = 72 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufRef = useRef<number[]>(new Array(180).fill(0));
  const lastRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const last = lastRef.current;
      let v = 0;
      if (last) {
        const dt = Math.max(1, now - last.t);
        v = Math.hypot(e.clientX - last.x, e.clientY - last.y) / dt;
      }
      lastRef.current = { x: e.clientX, y: e.clientY, t: now };
      const b = bufRef.current;
      b.push(Math.min(3, v));
      if (b.length > 180) b.shift();
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let phase = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const buf = bufRef.current;
      const n = buf.length;
      const mid = h / 2;
      const barW = w / n;
      phase += 0.06;

      for (let i = 0; i < n; i++) {
        // decay all bars slightly each frame so they smoothly settle
        buf[i] *= 0.985;
        const idle = Math.sin(phase + i * 0.18) * 0.06;
        const amp = (buf[i] / 3) * 0.9 + Math.abs(idle);
        const barH = amp * h * 0.9;
        const x = i * barW;
        const grad = ctx.createLinearGradient(x, mid - barH / 2, x, mid + barH / 2);
        grad.addColorStop(0, "oklch(0.78 0.16 200)");
        grad.addColorStop(0.5, "oklch(0.68 0.22 300)");
        grad.addColorStop(1, "oklch(0.78 0.16 200)");
        ctx.fillStyle = grad;
        ctx.fillRect(x + barW * 0.15, mid - barH / 2, barW * 0.7, Math.max(1, barH));
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="waveform-frame px-3 py-2" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
