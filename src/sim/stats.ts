import { at } from "./array";
import {
  MATERIAL_SOLID,
  OFFSET_F,
  OFFSET_MATERIAL,
  OFFSET_V,
  OFFSET_X,
  PARTICLE_SPACING,
  PARTICLE_STRIDE,
} from "./params";

export interface Stats {
  count: number;
  /** Mean y of all particles in domain units; 0 is the floor. */
  meanHeight: number;
  maxSpeed: number;
  /** Current area of the solid particles, Σ det(F) × spacing²; 0 without solids. */
  solidArea: number;
  /** False once any value is not finite or a particle has left the domain. */
  healthy: boolean;
}

/** Summarise a read-back particle buffer. */
export const summarize = (data: Float32Array): Stats => {
  const count = data.length / PARTICLE_STRIDE;
  let heightSum = 0;
  let maxSpeed = 0;
  let healthy = true;
  let solidArea = 0;
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    const x = at(data, base + OFFSET_X);
    const y = at(data, base + OFFSET_X + 1);
    const speed = Math.hypot(
      at(data, base + OFFSET_V),
      at(data, base + OFFSET_V + 1),
    );
    const solid = at(data, base + OFFSET_MATERIAL) === MATERIAL_SOLID;
    const f00 = at(data, base + OFFSET_F);
    const f10 = at(data, base + OFFSET_F + 1);
    const f01 = at(data, base + OFFSET_F + 2);
    const f11 = at(data, base + OFFSET_F + 3);
    const deformation = solid ? Math.hypot(f00, f10, f01, f11) : 0;
    if (
      !Number.isFinite(x + y + speed + deformation) ||
      x < -PARTICLE_SPACING ||
      x > 1 + PARTICLE_SPACING ||
      y < -PARTICLE_SPACING ||
      y > 1 + PARTICLE_SPACING
    ) {
      healthy = false;
      continue;
    }
    heightSum += y;
    maxSpeed = Math.max(maxSpeed, speed);
    if (solid) solidArea += (f00 * f11 - f01 * f10) * PARTICLE_SPACING ** 2;
  }
  return {
    count,
    meanHeight: count === 0 ? 0 : heightSum / count,
    maxSpeed,
    solidArea,
    healthy,
  };
};
