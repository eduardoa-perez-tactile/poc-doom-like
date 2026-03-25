export interface FixedStepLoopDelegate {
  update(dt: number): void;
  render(alpha: number): void;
}

export class FixedStepLoop {
  private readonly fixedDt = 1 / 60;
  private readonly maxFrameDt = 0.25;
  private accumulator = 0;
  private running = false;
  private rafId = 0;
  private lastTime = 0;

  constructor(private readonly delegate: FixedStepLoopDelegate) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.rafId = window.requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    window.cancelAnimationFrame(this.rafId);
  }

  private readonly onFrame = (): void => {
    if (!this.running) {
      return;
    }

    const now = performance.now() / 1000;
    const frameDt = Math.min(now - this.lastTime, this.maxFrameDt);
    this.lastTime = now;
    this.accumulator += frameDt;

    while (this.accumulator >= this.fixedDt) {
      this.delegate.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.delegate.render(this.accumulator / this.fixedDt);
    this.rafId = window.requestAnimationFrame(this.onFrame);
  };
}
