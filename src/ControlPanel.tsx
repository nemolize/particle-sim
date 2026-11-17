import type { ReactNode } from "react";

import {
  asPointerMode,
  asScene,
  GRAVITY_RANGE,
  POINTER_MODE_LABELS,
  POINTER_MODES,
  SCENE_LABELS,
  SCENES,
  type Settings,
  SOLID_STIFFNESS_RANGE,
  STIFFNESS_RANGE,
} from "@/settings";
import type { Stats } from "@/sim/stats";

export interface MotionControl {
  enabled: boolean;
  message: string | undefined;
  onChange: (enabled: boolean) => void;
}

interface Props {
  settings: Settings;
  stats: Stats;
  paused: boolean;
  motion: MotionControl | undefined;
  onChange: (next: Settings) => void;
  onPausedChange: (paused: boolean) => void;
  onReset: () => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
    {label}
    {children}
  </label>
);

const SELECT_CLASS =
  "rounded border border-gray-300 bg-white p-1.5 font-normal";
const BUTTON_CLASS =
  "grow rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700";

export const ControlPanel = ({
  settings,
  stats,
  paused,
  motion,
  onChange,
  onPausedChange,
  onReset,
}: Props) => (
  <aside className="flex w-full flex-col gap-4 rounded-lg bg-white/95 p-4 shadow-lg">
    <div className="grid grid-cols-1 gap-3">
      <Field label="Scene">
        <select
          className={SELECT_CLASS}
          value={settings.scene}
          onChange={(event) => {
            const scene = asScene(event.target.value);
            if (scene !== undefined) onChange({ ...settings, scene });
          }}
        >
          {SCENES.map((name) => (
            <option key={name} value={name}>
              {SCENE_LABELS[name]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pointer">
        <select
          className={SELECT_CLASS}
          value={settings.pointerMode}
          onChange={(event) => {
            const pointerMode = asPointerMode(event.target.value);
            if (pointerMode !== undefined) {
              onChange({ ...settings, pointerMode });
            }
          }}
        >
          {POINTER_MODES.map((name) => (
            <option key={name} value={name}>
              {POINTER_MODE_LABELS[name]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Fluid stiffness ${String(settings.stiffness)}`}>
        <input
          type="range"
          {...STIFFNESS_RANGE}
          value={settings.stiffness}
          onChange={(event) => {
            onChange({ ...settings, stiffness: event.target.valueAsNumber });
          }}
        />
      </Field>
      <Field label={`Solid stiffness ${String(settings.solidStiffness)}`}>
        <input
          type="range"
          {...SOLID_STIFFNESS_RANGE}
          value={settings.solidStiffness}
          onChange={(event) => {
            onChange({
              ...settings,
              solidStiffness: event.target.valueAsNumber,
            });
          }}
        />
      </Field>
      <Field label={`Gravity ${settings.gravity.toFixed(1)}`}>
        <input
          type="range"
          {...GRAVITY_RANGE}
          value={settings.gravity}
          onChange={(event) => {
            onChange({ ...settings, gravity: event.target.valueAsNumber });
          }}
        />
      </Field>
      {motion === undefined ? null : (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={motion.enabled}
              onChange={(event) => {
                motion.onChange(event.target.checked);
              }}
            />
            Motion
          </label>
          {motion.message === undefined ? null : (
            <p role="status" className="text-xs text-red-700">
              {motion.message}
            </p>
          )}
        </div>
      )}
    </div>
    <div className="flex gap-2">
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => {
          onPausedChange(!paused);
        }}
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={onReset}>
        Reset
      </button>
    </div>
    <dl
      aria-label="Simulation statistics"
      className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-700"
    >
      <dt>Particles</dt>
      <dd className="text-right tabular-nums">{stats.count}</dd>
      <dt>Mean height</dt>
      <dd className="text-right tabular-nums">{stats.meanHeight.toFixed(3)}</dd>
      <dt>Max speed</dt>
      <dd className="text-right tabular-nums">{stats.maxSpeed.toFixed(2)}</dd>
      <dt>Solid area</dt>
      <dd className="text-right tabular-nums">{stats.solidArea.toFixed(3)}</dd>
      <dt>State</dt>
      <dd className="text-right">{stats.healthy ? "Stable" : "Diverged"}</dd>
    </dl>
    <p className="text-xs text-gray-500">
      Press and drag on the particles to {settings.pointerMode} them.
    </p>
  </aside>
);
