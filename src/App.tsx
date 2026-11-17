import { useState } from "react";

import { ControlPanel } from "@/ControlPanel";
import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import type { Stats } from "@/sim/stats";
import { SimulationCanvas } from "@/SimulationCanvas";

const INITIAL_STATS: Stats = {
  count: 0,
  meanHeight: 0,
  maxSpeed: 0,
  solidArea: 0,
  healthy: true,
};

/** `navigator.gpu` is how a browser advertises WebGPU. */
const supportsWebGpu = (): boolean => "gpu" in navigator;

const App = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-gray-50 p-4 md:flex-row md:items-start">
      <div className="flex min-w-0 grow flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Particle Sim</h1>
        {supportsWebGpu() ? (
          <SimulationCanvas
            settings={settings}
            paused={paused}
            resetToken={resetToken}
            onStats={setStats}
          />
        ) : (
          <p role="alert" className="rounded bg-amber-50 p-4 text-amber-900">
            This browser has no WebGPU. Try a recent Chrome, Edge or Safari.
          </p>
        )}
      </div>
      <ControlPanel
        settings={settings}
        stats={stats}
        paused={paused}
        onChange={setSettings}
        onPausedChange={setPaused}
        onReset={() => {
          setResetToken((token) => token + 1);
        }}
      />
    </main>
  );
};

export default App;
