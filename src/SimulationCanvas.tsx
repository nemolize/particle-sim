import { useEffect, useRef, useState } from "react";

import type { Settings } from "@/settings";
import { Simulator } from "@/sim/gpu/simulator";
import type { Vec2 } from "@/sim/motion";
import type { Stats } from "@/sim/stats";
import type { Pointer } from "@/sim/uniforms";

/** Cap the backing store on high-DPI displays: past 2x the extra pixels are not visible. */
const MAX_PIXEL_RATIO = 2;
/** Frames between particle read-backs for the statistics panel. */
const STATS_INTERVAL_FRAMES = 15;

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

    const resize = (): void => {
      const size = Math.round(
        canvas.clientWidth * Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
      );
      canvas.width = size;
      canvas.height = size;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const track = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = (event.clientX - rect.left) / rect.width;
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

    void Simulator.create(canvas, abort.signal)
      .then((simulator) => {
        if (abort.signal.aborted) return;
        if (simulator === undefined) {
          setFailed(true);
          return;
        }
        simulatorRef.current = simulator;
        simulator.load(settingsRef.current.scene);
        setReady(true);

        let frame = 0;
        let busy = false;
        const tick = (): void => {
          frameId = requestAnimationFrame(tick);
          if (busy) return;
          busy = true;
          frame++;
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
              if (stats !== undefined && !abort.signal.aborted) {
                onStatsRef.current(stats);
              }
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
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        aria-label="Particle simulation"
        data-ready={ready}
        className="aspect-square w-full touch-none rounded-lg bg-slate-900"
      />
      {failed ? (
        <p role="alert" className="text-sm text-red-700">
          WebGPU could not start on this device.
        </p>
      ) : null}
    </div>
  );
};
