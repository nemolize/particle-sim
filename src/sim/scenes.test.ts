import { expect, it } from "vitest";

import { type Scene, SCENES } from "@/settings";

import {
  CELL_SIZE,
  MATERIAL_FLUID,
  MATERIAL_SOLID,
  OFFSET_F,
  OFFSET_J,
  OFFSET_MATERIAL,
  OFFSET_V,
  OFFSET_X,
  PARTICLE_STRIDE,
} from "./params";
import { countParticles, createParticles } from "./scenes";

it.each(SCENES)(
  "%s: every particle is inside the walls, undeformed",
  (scene) => {
    const data = createParticles(scene);
    const count = countParticles(data);
    expect(count).toBeGreaterThan(1000);
    expect(data.length).toBe(count * PARTICLE_STRIDE);
    for (let i = 0; i < count; i++) {
      const base = i * PARTICLE_STRIDE;
      const x = data[base + OFFSET_X] ?? Number.NaN;
      const y = data[base + OFFSET_X + 1] ?? Number.NaN;
      // The grid zeroes velocity into the outer three cells.
      expect(x).toBeGreaterThan(3 * CELL_SIZE);
      expect(x).toBeLessThan(1 - 3 * CELL_SIZE);
      expect(y).toBeGreaterThan(3 * CELL_SIZE);
      expect(y).toBeLessThan(1 - 3 * CELL_SIZE);
      expect(data[base + OFFSET_J]).toBe(1);
      expect([0, 1, 2, 3].map((k) => data[base + OFFSET_F + k])).toEqual([
        1, 0, 0, 1,
      ]);
    }
  },
);

const materials = (scene: Scene): number[] => {
  const data = createParticles(scene);
  return Array.from(
    { length: countParticles(data) },
    (_, i) => data[i * PARTICLE_STRIDE + OFFSET_MATERIAL] ?? Number.NaN,
  );
};

it.each([
  ["dam", 13392],
  ["drop", 11969],
  ["collision", 6958],
] as const)("%s: keeps its %i particles, all fluid", (scene, expected) => {
  const all = materials(scene);
  expect(all).toHaveLength(expected);
  expect(all.every((material) => material === MATERIAL_FLUID)).toBe(true);
});

it("block: a solid-only scene", () => {
  expect(
    materials("block").every((material) => material === MATERIAL_SOLID),
  ).toBe(true);
});

it("splash: a solid block above a fluid pool", () => {
  const data = createParticles("splash");
  let solids = 0;
  let fluids = 0;
  let lowestSolid = Infinity;
  let highestFluid = -Infinity;
  for (let i = 0; i < countParticles(data); i++) {
    const base = i * PARTICLE_STRIDE;
    const y = data[base + OFFSET_X + 1] ?? Number.NaN;
    if (data[base + OFFSET_MATERIAL] === MATERIAL_SOLID) {
      solids++;
      lowestSolid = Math.min(lowestSolid, y);
    } else {
      fluids++;
      highestFluid = Math.max(highestFluid, y);
    }
  }
  expect(solids).toBeGreaterThan(500);
  expect(fluids).toBeGreaterThan(solids);
  expect(lowestSolid).toBeGreaterThan(highestFluid);
});

it("packs four particles per grid cell", () => {
  const count = countParticles(createParticles("dam"));
  const cells = ((0.42 - 0.06) / CELL_SIZE) * ((0.62 - 0.06) / CELL_SIZE);
  expect(count / cells).toBeCloseTo(4, 0);
});

it("gives the colliding blobs opposite velocities and a disc outline", () => {
  const data = createParticles("collision");
  const count = countParticles(data);
  const velocities = new Set<number>();
  for (let i = 0; i < count; i++) {
    velocities.add(data[i * PARTICLE_STRIDE + OFFSET_V] ?? Number.NaN);
  }
  expect([...velocities].sort()).toEqual([-3, 3]);
  // A disc of radius 0.13 holds fewer particles than its bounding square.
  const square = (2 * 0.13) ** 2 / (CELL_SIZE / 2) ** 2;
  expect(count).toBeLessThan(2 * square);
});
