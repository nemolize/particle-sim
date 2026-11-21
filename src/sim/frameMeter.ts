export interface FrameTiming {
  fps: number;
  processingMs: number;
}

export class FrameMeter {
  private readonly windowMs: number;
  private windowStart: number | undefined;
  private frames = 0;
  private timedFrames = 0;
  private totalMs = 0;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  record(now: number, durationMs: number | undefined): FrameTiming | undefined {
    this.windowStart ??= now;
    this.frames++;
    if (durationMs !== undefined) {
      this.timedFrames++;
      this.totalMs += durationMs;
    }
    const elapsed = now - this.windowStart;
    if (elapsed < this.windowMs) return undefined;
    const timing: FrameTiming = {
      fps: (this.frames * 1000) / elapsed,
      processingMs:
        this.timedFrames === 0 ? 0 : this.totalMs / this.timedFrames,
    };
    this.windowStart = now;
    this.frames = 0;
    this.timedFrames = 0;
    this.totalMs = 0;
    return timing;
  }
}
