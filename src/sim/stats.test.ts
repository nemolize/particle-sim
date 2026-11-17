import { expect, it } from "vitest";

import {
  MATERIAL_SOLID,
  OFFSET_F,
  OFFSET_MATERIAL,
  OFFSET_V,
  OFFSET_X,
  PARTICLE_STRIDE,
} from "./params";
import { summarize } from "./stats";

const buffer = (
  particles: {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    solid?: boolean;
    f?: number;
  }[],
): Float32Array => {
  const data = new Float32Array(particles.length * PARTICLE_STRIDE);
  particles.forEach((p, i) => {
    data[i * PARTICLE_STRIDE + OFFSET_X] = p.x;
    data[i * PARTICLE_STRIDE + OFFSET_X + 1] = p.y;
    data[i * PARTICLE_STRIDE + OFFSET_V] = p.vx ?? 0;
    data[i * PARTICLE_STRIDE + OFFSET_V + 1] = p.vy ?? 0;
    data[i * PARTICLE_STRIDE + OFFSET_MATERIAL] =
      p.solid === true ? MATERIAL_SOLID : 0;
    data[i * PARTICLE_STRIDE + OFFSET_F] = p.f ?? 1;
    data[i * PARTICLE_STRIDE + OFFSET_F + 3] = 1;
  });
  return data;
};

it("averages height and finds the fastest particle", () => {
  const stats = summarize(
    buffer([
      { x: 0.2, y: 0.2, vx: 3, vy: 4 },
      { x: 0.4, y: 0.6, vx: 1 },
    ]),
  );
  expect(stats.count).toBe(2);
  expect(stats.meanHeight).toBeCloseTo(0.4);
  expect(stats.maxSpeed).toBeCloseTo(5);
  expect(stats.healthy).toBe(true);
});

it("reports an empty buffer as healthy and flat", () => {
  expect(summarize(new Float32Array(0))).toEqual({
    count: 0,
    meanHeight: 0,
    maxSpeed: 0,
    solidArea: 0,
    healthy: true,
  });
});

it.each([
  ["NaN position", { x: Number.NaN, y: 0.5 }],
  ["infinite velocity", { x: 0.5, y: 0.5, vx: Number.POSITIVE_INFINITY }],
  ["left of the domain", { x: -0.1, y: 0.5 }],
  ["right of the domain", { x: 1.1, y: 0.5 }],
  ["below the domain", { x: 0.5, y: -0.1 }],
  ["above the domain", { x: 0.5, y: 1.1 }],
])("flags %s and leaves it out of the averages", (_name, bad) => {
  const stats = summarize(buffer([{ x: 0.5, y: 0.5, vx: 1 }, bad]));
  expect(stats.healthy).toBe(false);
  expect(stats.meanHeight).toBeCloseTo(0.25);
  expect(stats.maxSpeed).toBeCloseTo(1);
});

it("measures the box around the solid particles only", () => {
  const stats = summarize(
    buffer([
      { x: 0.2, y: 0.3, solid: true },
      { x: 0.5, y: 0.4, solid: true },
      { x: 0.9, y: 0.9 },
    ]),
  );
  expect(stats.solidArea).toBeCloseTo(0.3 * 0.1);
});

it("reports no solid area without solids", () => {
  expect(summarize(buffer([{ x: 0.5, y: 0.5 }])).solidArea).toBe(0);
});

it("flags a solid whose deformation gradient is not finite", () => {
  const stats = summarize(
    buffer([{ x: 0.5, y: 0.5, solid: true, f: Number.NaN }]),
  );
  expect(stats.healthy).toBe(false);
  expect(stats.solidArea).toBe(0);
});

it("ignores the deformation gradient of a fluid particle", () => {
  expect(summarize(buffer([{ x: 0.5, y: 0.5, f: Number.NaN }])).healthy).toBe(
    true,
  );
});
