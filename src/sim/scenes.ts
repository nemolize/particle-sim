import type { Scene } from "@/settings";

import {
  MATERIAL_FLUID,
  MATERIAL_SOLID,
  OFFSET_F,
  OFFSET_J,
  OFFSET_MATERIAL,
  OFFSET_V,
  OFFSET_X,
  PARTICLE_SPACING,
  PARTICLE_STRIDE,
} from "./params";

interface Blob {
  inside: (x: number, y: number) => boolean;
  /** Bounding box searched for lattice points. */
  min: readonly [number, number];
  max: readonly [number, number];
  velocity: readonly [number, number];
  material: number;
}

const rect = (
  min: readonly [number, number],
  max: readonly [number, number],
  velocity: readonly [number, number] = [0, 0],
  material = MATERIAL_FLUID,
): Blob => ({ inside: () => true, min, max, velocity, material });

const disc = (
  centre: readonly [number, number],
  radius: number,
  velocity: readonly [number, number] = [0, 0],
): Blob => ({
  inside: (x, y) => Math.hypot(x - centre[0], y - centre[1]) <= radius,
  min: [centre[0] - radius, centre[1] - radius],
  max: [centre[0] + radius, centre[1] + radius],
  velocity,
  material: MATERIAL_FLUID,
});

export const TILT_ANGLE = Math.PI / 6;

const tiltedSquare = (
  centre: readonly [number, number],
  side: number,
  angle: number,
  material: number,
): Blob => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const half = side / 2;
  const reach = half * (Math.abs(cos) + Math.abs(sin));
  return {
    inside: (x, y) => {
      const dx = x - centre[0];
      const dy = y - centre[1];
      return (
        Math.abs(cos * dx + sin * dy) <= half &&
        Math.abs(cos * dy - sin * dx) <= half
      );
    },
    min: [centre[0] - reach, centre[1] - reach],
    max: [centre[0] + reach, centre[1] + reach],
    velocity: [0, 0],
    material,
  };
};

const sceneBlobs = (scene: Scene, width: number): readonly Blob[] => {
  const middle = width / 2;
  const pool = rect([0.05, 0.05], [width - 0.05, 0.25]);
  switch (scene) {
    case "dam":
      return [rect([0.06, 0.06], [Math.min(0.42, width / 2), 0.62])];
    case "drop":
      return [
        rect([0.05, 0.05], [width - 0.05, 0.2]),
        disc([middle, 0.6], 0.12),
      ];
    case "collision": {
      // At the narrowest width the discs must stay clear of the wall cells.
      const radius = Math.min(0.13, width * 0.18);
      return [
        disc([width * 0.25, 0.5], radius, [3, 0]),
        disc([width * 0.75, 0.5], radius, [-3, 0]),
      ];
    }
    case "block":
      return [
        rect([middle - 0.1, 0.4], [middle + 0.1, 0.6], [0, 0], MATERIAL_SOLID),
      ];
    case "splash":
      return [
        pool,
        rect(
          [middle - 0.1, 0.3],
          [middle + 0.05, 0.45],
          [0, 0],
          MATERIAL_SOLID,
        ),
      ];
    case "tilt":
      return [
        pool,
        tiltedSquare([middle - 0.025, 0.375], 0.15, TILT_ANGLE, MATERIAL_SOLID),
      ];
  }
};

/** Particle data in the layout of the GPU buffer: undeformed (J = 1, F = identity). */
export const createParticles = (scene: Scene, width: number): Float32Array => {
  const values: number[] = [];
  for (const blob of sceneBlobs(scene, width)) {
    // Lattice points sit at cell-quarter offsets so every cell starts with four particles.
    for (let x = blob.min[0]; x <= blob.max[0]; x += PARTICLE_SPACING) {
      for (let y = blob.min[1]; y <= blob.max[1]; y += PARTICLE_SPACING) {
        if (!blob.inside(x, y)) continue;
        const particle = new Array<number>(PARTICLE_STRIDE).fill(0);
        particle[OFFSET_X] = x;
        particle[OFFSET_X + 1] = y;
        particle[OFFSET_V] = blob.velocity[0];
        particle[OFFSET_V + 1] = blob.velocity[1];
        particle[OFFSET_J] = 1;
        particle[OFFSET_MATERIAL] = blob.material;
        particle[OFFSET_F] = 1;
        particle[OFFSET_F + 3] = 1;
        values.push(...particle);
      }
    }
  }
  return Float32Array.from(values);
};

export const countParticles = (data: Float32Array): number =>
  data.length / PARTICLE_STRIDE;
