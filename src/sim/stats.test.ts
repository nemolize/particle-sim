import { expect, it } from "vitest";

import {
  MATERIAL_SOLID,
  OFFSET_F,
  OFFSET_MATERIAL,
  OFFSET_V,
  OFFSET_X,
  PARTICLE_SPACING,
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
    matrix?: readonly [number, number, number, number];
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
    const matrix = p.matrix ?? [1, 0, 0, 1];
    matrix.forEach((value, k) => {
      data[i * PARTICLE_STRIDE + OFFSET_F + k] = value;
    });
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

const SIDE = 40;
const BLOCK_AREA = (SIDE * PARTICLE_SPACING) ** 2;

const block = (angle: number, squeeze = 1): Float32Array => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const particles = Array.from({ length: SIDE * SIDE }, (_, i) => {
    const u = (i % SIDE) * PARTICLE_SPACING;
    const v = Math.floor(i / SIDE) * PARTICLE_SPACING * squeeze;
    return {
      x: 0.5 + cos * u - sin * v,
      y: 0.5 + sin * u + cos * v,
      solid: true,
      matrix: [cos, sin, -sin * squeeze, cos * squeeze] as const,
    };
  });
  return buffer(particles);
};

const TILTS = [0, 10, 30, 45, 90, 137];
const radians = (degrees: number): number => degrees * (Math.PI / 180);

it("sums the area the solid particles started with while undeformed", () => {
  expect(summarize(block(0)).solidArea).toBeCloseTo(BLOCK_AREA, 6);
});

it.each(TILTS)(
  "reads a block turned by %i degrees as the unturned block",
  (degrees) => {
    expect(summarize(block(radians(degrees))).solidArea).toBeCloseTo(
      BLOCK_AREA,
      6,
    );
  },
);

it.each(TILTS)(
  "reads a block squeezed to half as half, turned by %i degrees",
  (degrees) => {
    expect(summarize(block(radians(degrees), 0.5)).solidArea).toBeCloseTo(
      BLOCK_AREA / 2,
      6,
    );
  },
);

it("reports no solid area without solids", () => {
  expect(summarize(buffer([{ x: 0.5, y: 0.5 }])).solidArea).toBe(0);
});

it("flags a solid whose deformation gradient is not finite", () => {
  const stats = summarize(
    buffer([{ x: 0.5, y: 0.5, solid: true, matrix: [Number.NaN, 0, 0, 1] }]),
  );
  expect(stats.healthy).toBe(false);
  expect(stats.solidArea).toBe(0);
});

it("ignores the deformation gradient of a fluid particle", () => {
  expect(
    summarize(buffer([{ x: 0.5, y: 0.5, matrix: [Number.NaN, 0, 0, 1] }]))
      .healthy,
  ).toBe(true);
});
