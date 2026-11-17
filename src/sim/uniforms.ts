import type { PointerMode, Settings } from "@/settings";

import { POINTER_ACCELERATION, POINTER_RADIUS, TIME_STEP } from "./params";

export interface Pointer {
  x: number;
  y: number;
  pressed: boolean;
}

/** Size of the WGSL `Params` struct: 36 bytes of fields, rounded up to its 8-byte alignment. */
export const UNIFORM_BYTES = 40;

const POINTER_SIGN: Record<PointerMode, number> = { attract: 1, repel: -1 };

/** Pack the per-frame parameters in the field order of the WGSL `Params` struct. */
export const packUniforms = (
  settings: Settings,
  count: number,
  pointer: Pointer,
): ArrayBuffer => {
  const buffer = new ArrayBuffer(UNIFORM_BYTES);
  const floats = new Float32Array(buffer);
  floats[0] = settings.gravity;
  floats[1] = settings.stiffness;
  floats[2] = TIME_STEP;
  new Uint32Array(buffer)[3] = count;
  floats[4] = pointer.x;
  floats[5] = pointer.y;
  floats[6] = POINTER_RADIUS;
  floats[7] = pointer.pressed
    ? POINTER_ACCELERATION * POINTER_SIGN[settings.pointerMode]
    : 0;
  floats[8] = settings.solidStiffness;
  return buffer;
};
