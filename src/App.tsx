import { useEffect, useRef, useState } from "react";

import { ControlPanel } from "@/ControlPanel";
import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import type { Stats } from "@/sim/stats";
import { SimulationCanvas } from "@/SimulationCanvas";
import { useMotionInput } from "@/useMotionInput";

const INITIAL_STATS: Stats = {
  count: 0,
  meanHeight: 0,
  maxSpeed: 0,
  solidArea: 0,
  healthy: true,
};

/** `navigator.gpu` is how a browser advertises WebGPU. */
const supportsWebGpu = (): boolean => "gpu" in navigator;

const PANEL_ID = "settings-panel";

const App = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [panelOpen, setPanelOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const motion = useMotionInput();

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  return (
    <main className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-gray-50">
      <h1 className="sr-only text-2xl font-bold text-gray-800">Particle Sim</h1>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={panelOpen}
        aria-controls={PANEL_ID}
        className="absolute top-4 right-4 z-10 rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-gray-700"
        onClick={() => {
          setPanelOpen(!panelOpen);
        }}
      >
        Settings
      </button>
      <div className="size-[min(100dvw,100dvh)]">
        {supportsWebGpu() ? (
          <SimulationCanvas
            settings={settings}
            paused={paused}
            resetToken={resetToken}
            onStats={setStats}
            readGravity={motion.readGravity}
          />
        ) : (
          <p role="alert" className="rounded bg-amber-50 p-4 text-amber-900">
            This browser has no WebGPU. Try a recent Chrome, Edge or Safari.
          </p>
        )}
      </div>
      {panelOpen ? (
        <div
          id={PANEL_ID}
          className="absolute top-16 right-4 z-10 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg"
        >
          <ControlPanel
            settings={settings}
            stats={stats}
            paused={paused}
            motion={
              motion.available
                ? {
                    enabled: motion.enabled,
                    message: motion.message,
                    onChange: motion.setEnabled,
                  }
                : undefined
            }
            onChange={setSettings}
            onPausedChange={setPaused}
            onReset={() => {
              setResetToken((token) => token + 1);
            }}
          />
        </div>
      ) : null}
    </main>
  );
};

export default App;
