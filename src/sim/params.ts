/** Cells per side of the background grid; the domain is the unit square. */
export const GRID_SIZE = 128;
export const CELL_SIZE = 1 / GRID_SIZE;
export const FRAME_TIME = 0.01;
/**
 * Fluid stiffness at which `REFERENCE_SUBSTEPS` steps per frame are stable (see `timestep.ts`),
 * a wave-speed-times-step over cell size of about 0.51; measured unstable from about 0.63.
 */
export const REFERENCE_STIFFNESS = 400;
export const REFERENCE_SUBSTEPS = 50;
/** Grid sums are accumulated as `i32` through `atomicAdd`, so floats are scaled by this. */
export const FIXED_POINT_SCALE = 2 ** 16;
/** Particles per cell side; the stress term in the shader assumes four per cell. */
const PARTICLES_PER_CELL_SIDE = 2;
export const PARTICLE_SPACING = CELL_SIZE / PARTICLES_PER_CELL_SIDE;

/**
 * Floats per particle, matching the WGSL `Particle` struct: x(2) v(2) C(4) J(1)
 * material(1) F(4), matrices column-major. A fluid ignores F, a solid ignores J.
 */
export const PARTICLE_STRIDE = 14;
export const OFFSET_X = 0;
export const OFFSET_V = 2;
export const OFFSET_J = 8;
export const OFFSET_MATERIAL = 9;
export const OFFSET_F = 10;

export const MATERIAL_FLUID = 0;
export const MATERIAL_SOLID = 1;

/** Radius of the pointer's influence, as a fraction of the domain. */
export const POINTER_RADIUS = 0.12;
/** Pointer acceleration at its centre, in domain units per second squared. */
export const POINTER_ACCELERATION = 80;
