import type { PointerMode, Settings } from "@/settings";

import type { Vec2 } from "./motion";
import { POINTER_ACCELERATION, POINTER_RADIUS } from "./params";
import { timeStepFor } from "./timestep";

/** The pointer in domain units: x across the domain's width, y up from the floor. */
export interface Pointer {
  x: number;
  y: number;
  pressed: boolean;
}

export const UNIFORM_BYTES = 48;

const POINTER_SIGN: Record<PointerMode, number> = { attract: 1, repel: -1 };

/**
 * Pack the per-frame parameters in the field order of the WGSL `Params` struct.
 * `pull` is gravity in units of 1 g, which `settings.gravity` scales.
 */
export const packUniforms = (
  settings: Settings,
  count: number,
  pointer: Pointer,
  pull: Vec2,
  gridColumns: number,
): ArrayBuffer => {
  const buffer = new ArrayBuffer(UNIFORM_BYTES);
  const floats = new Float32Array(buffer);
  floats[0] = pull.x * settings.gravity;
  floats[1] = pull.y * settings.gravity;
  floats[2] = pointer.x;
  floats[3] = pointer.y;
  floats[4] = settings.stiffness;
  floats[5] = timeStepFor(settings.stiffness);
  new Uint32Array(buffer)[6] = count;
  floats[7] = POINTER_RADIUS;
  floats[8] = pointer.pressed
    ? POINTER_ACCELERATION * POINTER_SIGN[settings.pointerMode]
    : 0;
  floats[9] = settings.solidStiffness;
  new Uint32Array(buffer)[10] = gridColumns;
  return buffer;
};
