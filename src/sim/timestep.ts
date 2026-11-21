import { FRAME_TIME, REFERENCE_STIFFNESS, REFERENCE_SUBSTEPS } from "./params";

/**
 * The fluid's wave speed grows with the square root of its stiffness, so the explicit step
 * must shrink in proportion to stay stable. Never fewer substeps than the reference.
 */
export const substepsFor = (stiffness: number): number =>
  Math.max(
    REFERENCE_SUBSTEPS,
    Math.ceil(REFERENCE_SUBSTEPS * Math.sqrt(stiffness / REFERENCE_STIFFNESS)),
  );

export const timeStepFor = (stiffness: number): number =>
  FRAME_TIME / substepsFor(stiffness);
