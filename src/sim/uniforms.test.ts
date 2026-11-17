import { expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/settings";

import { POINTER_ACCELERATION, POINTER_RADIUS, TIME_STEP } from "./params";
import { packUniforms, UNIFORM_BYTES } from "./uniforms";

const pack = (pressed: boolean, pointerMode = DEFAULT_SETTINGS.pointerMode) => {
  const buffer = packUniforms({ ...DEFAULT_SETTINGS, pointerMode }, 12345, {
    x: 0.3,
    y: 0.7,
    pressed,
  });
  return { floats: new Float32Array(buffer), uints: new Uint32Array(buffer) };
};

it("matches the field order of the WGSL Params struct", () => {
  const { floats, uints } = pack(true);
  expect(floats.byteLength).toBe(UNIFORM_BYTES);
  expect(floats[0]).toBeCloseTo(DEFAULT_SETTINGS.gravity);
  expect(floats[1]).toBe(DEFAULT_SETTINGS.stiffness);
  expect(floats[2]).toBeCloseTo(TIME_STEP);
  expect(uints[3]).toBe(12345);
  expect(floats[4]).toBeCloseTo(0.3);
  expect(floats[5]).toBeCloseTo(0.7);
  expect(floats[6]).toBeCloseTo(POINTER_RADIUS);
  expect(floats[7]).toBe(POINTER_ACCELERATION);
  expect(floats[8]).toBe(DEFAULT_SETTINGS.solidStiffness);
});

it("carries the solid stiffness of the settings it is given", () => {
  const buffer = packUniforms({ ...DEFAULT_SETTINGS, solidStiffness: 225 }, 1, {
    x: 0,
    y: 0,
    pressed: false,
  });
  expect(new Float32Array(buffer)[8]).toBe(225);
});

it("flips the pointer force to repel and switches it off when released", () => {
  expect(pack(true, "repel").floats[7]).toBe(-POINTER_ACCELERATION);
  expect(pack(false).floats[7]).toBe(0);
});
