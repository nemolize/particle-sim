import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ControlPanel, type MotionControl } from "./ControlPanel";
import { DEFAULT_SETTINGS } from "./settings";
import type { Stats } from "./sim/stats";

const STATS: Stats = {
  count: 1234,
  meanHeight: 0.25,
  maxSpeed: 2,
  solidArea: 0.04,
  healthy: true,
};

const setup = (
  stats: Stats = STATS,
  paused = false,
  motion?: MotionControl,
) => {
  const onChange = vi.fn();
  const onPausedChange = vi.fn();
  const onReset = vi.fn();
  render(
    <ControlPanel
      settings={DEFAULT_SETTINGS}
      stats={stats}
      paused={paused}
      motion={motion}
      onChange={onChange}
      onPausedChange={onPausedChange}
      onReset={onReset}
    />,
  );
  return { onChange, onPausedChange, onReset };
};

it("reports each setting change with the rest unchanged", async () => {
  const user = userEvent.setup();
  const { onChange } = setup();
  await user.selectOptions(screen.getByLabelText("Scene"), "collision");
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_SETTINGS,
    scene: "collision",
  });
  await user.selectOptions(screen.getByLabelText("Pointer"), "repel");
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_SETTINGS,
    pointerMode: "repel",
  });
  fireEvent.change(screen.getByLabelText(/^Fluid stiffness/), {
    target: { value: "600" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_SETTINGS,
    stiffness: 600,
  });
  fireEvent.change(screen.getByLabelText(/^Solid stiffness/), {
    target: { value: "200" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_SETTINGS,
    solidStiffness: 200,
  });
  fireEvent.change(screen.getByLabelText(/^Gravity/), {
    target: { value: "5" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_SETTINGS,
    gravity: 5,
  });
});

it("ignores a value that is not a known option", () => {
  const { onChange } = setup();
  fireEvent.change(screen.getByLabelText("Scene"), {
    target: { value: "nonsense" },
  });
  fireEvent.change(screen.getByLabelText("Pointer"), {
    target: { value: "nonsense" },
  });
  expect(onChange).not.toHaveBeenCalled();
});

it("toggles pause and resets", async () => {
  const user = userEvent.setup();
  const { onPausedChange, onReset } = setup();
  await user.click(screen.getByRole("button", { name: "Pause" }));
  expect(onPausedChange).toHaveBeenCalledWith(true);
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(onReset).toHaveBeenCalledOnce();
});

it("offers Resume while paused", () => {
  setup(STATS, true);
  expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
});

it("shows the statistics and flags a diverged run", () => {
  setup();
  const stats = screen.getByLabelText("Simulation statistics");
  expect(stats).toHaveTextContent("1234");
  expect(stats).toHaveTextContent("0.250");
  expect(stats).toHaveTextContent("0.040");
  expect(stats).toHaveTextContent("Stable");
});

it("names a diverged run", () => {
  setup({ ...STATS, healthy: false });
  expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
    "Diverged",
  );
});

it("hides the Motion toggle on a device without sensors", () => {
  setup();
  expect(screen.queryByLabelText("Motion")).toBeNull();
});

it("reports the Motion toggle and shows why it could not turn on", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  setup(STATS, false, {
    enabled: true,
    message: "Motion was denied",
    onChange,
  });
  const toggle = screen.getByLabelText("Motion");
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(onChange).toHaveBeenCalledWith(false);
  expect(screen.getByRole("status")).toHaveTextContent("Motion was denied");
});

it("shows no status message while there is nothing to say", () => {
  setup(STATS, false, {
    enabled: false,
    message: undefined,
    onChange: vi.fn(),
  });
  expect(screen.getByLabelText("Motion")).not.toBeChecked();
  expect(screen.queryByRole("status")).toBeNull();
});
