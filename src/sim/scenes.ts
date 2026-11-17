import type { Scene } from "@/settings";

import {
  OFFSET_J,
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
}

const rect = (
  min: readonly [number, number],
  max: readonly [number, number],
  velocity: readonly [number, number] = [0, 0],
): Blob => ({ inside: () => true, min, max, velocity });

const disc = (
  centre: readonly [number, number],
  radius: number,
  velocity: readonly [number, number] = [0, 0],
): Blob => ({
  inside: (x, y) => Math.hypot(x - centre[0], y - centre[1]) <= radius,
  min: [centre[0] - radius, centre[1] - radius],
  max: [centre[0] + radius, centre[1] + radius],
  velocity,
});

const SCENE_BLOBS: Record<Scene, readonly Blob[]> = {
  dam: [rect([0.06, 0.06], [0.42, 0.62])],
  drop: [rect([0.05, 0.05], [0.95, 0.2]), disc([0.5, 0.6], 0.12)],
  collision: [
    disc([0.25, 0.5], 0.13, [3, 0]),
    disc([0.75, 0.5], 0.13, [-3, 0]),
  ],
};

/** Particle data in the layout of the GPU buffer: at rest, undeformed (J = 1). */
export const createParticles = (scene: Scene): Float32Array => {
  const values: number[] = [];
  for (const blob of SCENE_BLOBS[scene]) {
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
        values.push(...particle);
      }
    }
  }
  return Float32Array.from(values);
};

export const countParticles = (data: Float32Array): number =>
  data.length / PARTICLE_STRIDE;
