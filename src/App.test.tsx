import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("@/SimulationCanvas", () => ({
  SimulationCanvas: ({ paused }: { paused: boolean }) => (
    <div role="img" aria-label="Particle simulation">
      {paused ? "paused" : "running"}
    </div>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("explains that WebGPU is missing instead of rendering a canvas", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Particle Sim" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("no WebGPU");
  expect(screen.queryByLabelText("Particle simulation")).toBeNull();
});

it("renders the canvas with its controls when WebGPU exists", () => {
  vi.stubGlobal("navigator", { gpu: {} });
  render(<App />);
  expect(screen.getByLabelText("Particle simulation")).toBeInTheDocument();
  expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
    "Stable",
  );
});

it("wires the controls to the settings", async () => {
  vi.stubGlobal("navigator", { gpu: {} });
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText("Scene"), "drop");
  expect(screen.getByLabelText("Scene")).toHaveValue("drop");
  await user.click(screen.getByRole("button", { name: "Pause" }));
  expect(screen.getByLabelText("Particle simulation")).toHaveTextContent(
    "paused",
  );
  expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Reset" }));
});
