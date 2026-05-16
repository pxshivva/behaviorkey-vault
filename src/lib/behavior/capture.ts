export type MousePoint = { x: number; y: number; t: number };
export type KeyEvent = { key: string; type: "down" | "up"; t: number };

export type RawSample = {
  mouse: MousePoint[];
  keys: KeyEvent[];
  startedAt: number;
  endedAt: number;
};

export class SampleRecorder {
  private mouse: MousePoint[] = [];
  private keys: KeyEvent[] = [];
  private startedAt = 0;
  private running = false;
  private mouseEl: HTMLElement | null = null;
  private keyEl: HTMLElement | null = null;

  private onMouse = (e: MouseEvent) => {
    if (!this.running) return;
    this.mouse.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.running) return;
    if (e.key.length === 0) return;
    this.keys.push({ key: e.key, type: "down", t: performance.now() });
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.running) return;
    this.keys.push({ key: e.key, type: "up", t: performance.now() });
  };

  start(mouseEl: HTMLElement, keyEl: HTMLElement) {
    this.mouse = [];
    this.keys = [];
    this.startedAt = performance.now();
    this.mouseEl = mouseEl;
    this.keyEl = keyEl;
    mouseEl.addEventListener("mousemove", this.onMouse);
    keyEl.addEventListener("keydown", this.onKeyDown);
    keyEl.addEventListener("keyup", this.onKeyUp);
    this.running = true;
  }
  stop(): RawSample {
    this.running = false;
    this.mouseEl?.removeEventListener("mousemove", this.onMouse);
    this.keyEl?.removeEventListener("keydown", this.onKeyDown);
    this.keyEl?.removeEventListener("keyup", this.onKeyUp);
    return {
      mouse: this.mouse,
      keys: this.keys,
      startedAt: this.startedAt,
      endedAt: performance.now(),
    };
  }
  isRunning() { return this.running; }
  liveMouse() { return this.mouse; }
}
