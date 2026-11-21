import { expect, it } from "vitest";

import { STIFFNESS_RANGE } from "@/settings";

import {
  CELL_SIZE,
  FRAME_TIME,
  REFERENCE_STIFFNESS,
  REFERENCE_SUBSTEPS,
} from "./params";
import { substepsFor, timeStepFor } from "./timestep";

/** Chosen empirically between a measured-stable 0.51 and a measured-unstable 0.63 on the dam scene. */
const COURANT_LIMIT = 0.55;

const courant = (stiffness: number): number =>
  (Math.sqrt(stiffness) * timeStepFor(stiffness)) / CELL_SIZE;

it("keeps the reference step at the reference stiffness", () => {
  expect(substepsFor(REFERENCE_STIFFNESS)).toBe(REFERENCE_SUBSTEPS);
  expect(timeStepFor(REFERENCE_STIFFNESS)).toBeCloseTo(2e-4, 8);
});

it("never uses fewer substeps than the reference", () => {
  expect(substepsFor(STIFFNESS_RANGE.min)).toBe(REFERENCE_SUBSTEPS);
});

it("advances the same simulated time per frame at any stiffness", () => {
  for (const k of [100, 400, 800]) {
    expect(substepsFor(k) * timeStepFor(k)).toBeCloseTo(FRAME_TIME, 8);
  }
});

it("keeps the step-to-wave-speed ratio under the stability limit across the range", () => {
  const { min, max, step } = STIFFNESS_RANGE;
  const count = (max - min) / step + 1;
  for (let i = 0; i < count; i++) {
    expect(courant(min + i * step)).toBeLessThan(COURANT_LIMIT);
  }
});
