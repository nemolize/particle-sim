import { expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/settings";

import { GRAVITY_AT_REST } from "./motion";
import { POINTER_ACCELERATION, POINTER_RADIUS, TIME_STEP } from "./params";
import { packUniforms, UNIFORM_BYTES } from "./uniforms";

const pack = (pressed: boolean, pointerMode = DEFAULT_SETTINGS.pointerMode) => {
  const buffer = packUniforms(
    { ...DEFAULT_SETTINGS, pointerMode },
    12345,
    { x: 0.3, y: 0.7, pressed },
    GRAVITY_AT_REST,
  );
  return { floats: new Float32Array(buffer), uints: new Uint32Array(buffer) };
};

it("matches the field order of the WGSL Params struct", () => {
  const { floats, uints } = pack(true);
  expect(floats.byteLength).toBe(UNIFORM_BYTES);
  expect(floats[0]).toBeCloseTo(0);
  expect(floats[1]).toBeCloseTo(-DEFAULT_SETTINGS.gravity);
  expect(floats[2]).toBeCloseTo(0.3);
  expect(floats[3]).toBeCloseTo(0.7);
  expect(floats[4]).toBe(DEFAULT_SETTINGS.stiffness);
  expect(floats[5]).toBeCloseTo(TIME_STEP);
  expect(uints[6]).toBe(12345);
  expect(floats[7]).toBeCloseTo(POINTER_RADIUS);
  expect(floats[8]).toBe(POINTER_ACCELERATION);
  expect(floats[9]).toBe(DEFAULT_SETTINGS.solidStiffness);
});

it("packs the default settings as the straight-down gravity it always had", () => {
  const { floats } = pack(false);
  expect(Array.from(floats.slice(0, 2))).toEqual([0, -9.8].map(Math.fround));
});

it("scales the pull by the gravity setting", () => {
  const buffer = packUniforms(
    { ...DEFAULT_SETTINGS, gravity: 5 },
    1,
    { x: 0, y: 0, pressed: false },
    { x: 2, y: 3 },
  );
  expect(Array.from(new Float32Array(buffer).slice(0, 2))).toEqual([10, 15]);
});

it("carries the solid stiffness of the settings it is given", () => {
  const buffer = packUniforms(
    { ...DEFAULT_SETTINGS, solidStiffness: 225 },
    1,
    { x: 0, y: 0, pressed: false },
    GRAVITY_AT_REST,
  );
  expect(new Float32Array(buffer)[9]).toBe(225);
});

it("flips the pointer force to repel and switches it off when released", () => {
  expect(pack(true, "repel").floats[8]).toBe(-POINTER_ACCELERATION);
  expect(pack(false).floats[8]).toBe(0);
});
