import { at } from "./array";
import {
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
  /** False once any value is not finite or a particle has left the domain. */
  healthy: boolean;
}

/** Summarise a read-back particle buffer. */
export const summarize = (data: Float32Array): Stats => {
  const count = data.length / PARTICLE_STRIDE;
  let heightSum = 0;
  let maxSpeed = 0;
  let healthy = true;
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    const x = at(data, base + OFFSET_X);
    const y = at(data, base + OFFSET_X + 1);
    const speed = Math.hypot(
      at(data, base + OFFSET_V),
      at(data, base + OFFSET_V + 1),
    );
    if (
      !Number.isFinite(x + y + speed) ||
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
  }
  return {
    count,
    meanHeight: count === 0 ? 0 : heightSum / count,
    maxSpeed,
    healthy,
  };
};
