import { useEffect, useRef, useState } from "react";

import type { Settings } from "@/settings";
import { domainWidthFor, gridColumnsFor } from "@/sim/domain";
import { FrameMeter, type FrameTiming } from "@/sim/frameMeter";
import { Simulator } from "@/sim/gpu/simulator";
import type { Vec2 } from "@/sim/motion";
import type { Stats } from "@/sim/stats";
import type { Pointer } from "@/sim/uniforms";

/** Cap the backing store on high-DPI displays: past 2x the extra pixels are not visible. */
const MAX_PIXEL_RATIO = 2;
const RELAYOUT_DELAY_MS = 300;
/** Frames between particle read-backs for the statistics panel. */
const STATS_INTERVAL_FRAMES = 15;
const TIMING_WINDOW_MS = 500;

interface Props {
  settings: Settings;
  paused: boolean;
  /** Bumped by the Reset button to reload the scene with unchanged settings. */
  resetToken: number;
  onStats: (stats: Stats) => void;
  readGravity: () => Vec2;
}

export const SimulationCanvas = ({
  settings,
  paused,
  resetToken,
  onStats,
  readGravity,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulatorRef = useRef<Simulator>(undefined);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [timing, setTiming] = useState<FrameTiming>();
  // Read inside the frame loop through refs so a slider move does not restart it.
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const onStatsRef = useRef(onStats);
  const readGravityRef = useRef(readGravity);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, pressed: false });
  useEffect(() => {
    settingsRef.current = settings;
    pausedRef.current = paused;
    onStatsRef.current = onStats;
    readGravityRef.current = readGravity;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const abort = new AbortController();
    let frameId = 0;

    let gridColumns = 0;
    let relayoutTimer: ReturnType<typeof setTimeout> | undefined;
    const resize = (): void => {
      const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      gridColumns = gridColumnsFor(canvas.clientWidth, canvas.clientHeight);
      const simulator = simulatorRef.current;
      if (simulator === undefined) return;
      simulator.setGridColumns(gridColumns);
      clearTimeout(relayoutTimer);
      relayoutTimer = setTimeout(() => {
        if (simulator.sceneIsStale) simulator.load(settingsRef.current.scene);
      }, RELAYOUT_DELAY_MS);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const track = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) *
        domainWidthFor(gridColumns);
      pointerRef.current.y = 1 - (event.clientY - rect.top) / rect.height;
    };
    const onPointerDown = (event: PointerEvent): void => {
      canvas.setPointerCapture(event.pointerId);
      track(event);
      pointerRef.current.pressed = true;
    };
    const onPointerUp = (): void => {
      pointerRef.current.pressed = false;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", track);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    void Simulator.create(canvas, abort.signal, gridColumns)
      .then((simulator) => {
        if (abort.signal.aborted) return;
        if (simulator === undefined) {
          setFailed(true);
          return;
        }
        simulatorRef.current = simulator;
        // The canvas may have resized while the device was being requested.
        simulator.setGridColumns(gridColumns);
        simulator.load(settingsRef.current.scene);
        setReady(true);

        let frame = 0;
        let busy = false;
        const meter = new FrameMeter(TIMING_WINDOW_MS);
        const tick = (): void => {
          frameId = requestAnimationFrame(tick);
          if (busy) return;
          busy = true;
          frame++;
          const startedAt = performance.now();
          void simulator
            .frame(
              settingsRef.current,
              pointerRef.current,
              readGravityRef.current(),
              {
                step: !pausedRef.current,
                readStats: frame % STATS_INTERVAL_FRAMES === 0,
              },
            )
            .then((stats) => {
              if (abort.signal.aborted) return;
              if (stats !== undefined) onStatsRef.current(stats);
              const now = performance.now();
              // A read-back frame also waited on the copy, so it is not timed.
              const next = meter.record(
                now,
                stats === undefined ? now - startedAt : undefined,
              );
              if (next !== undefined) setTiming(next);
            })
            .catch(() => {
              if (!abort.signal.aborted) setFailed(true);
            })
            .finally(() => {
              busy = false;
            });
        };
        frameId = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => {
      abort.abort();
      clearTimeout(relayoutTimer);
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", track);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      simulatorRef.current?.destroy();
      simulatorRef.current = undefined;
      setReady(false);
    };
  }, []);

  const { scene } = settings;
  useEffect(() => {
    if (ready) simulatorRef.current?.load(scene);
  }, [ready, scene, resetToken]);

  return (
    <div className="relative size-full">
      <canvas
        ref={canvasRef}
        aria-label="Particle simulation"
        data-ready={ready}
        className="size-full touch-none bg-slate-900"
      />
      {timing === undefined ? null : (
        <p
          aria-label="Frame timing"
          className="pointer-events-none absolute top-4 left-4 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white tabular-nums"
        >
          {timing.fps.toFixed(0)} FPS · {timing.processingMs.toFixed(1)} ms
        </p>
      )}
      {failed ? (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-white/90 p-2 text-sm text-red-700"
        >
          WebGPU could not start on this device.
        </p>
      ) : null}
    </div>
  );
};
