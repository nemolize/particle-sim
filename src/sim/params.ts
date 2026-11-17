/** Cells per side of the background grid; the domain is the unit square. */
export const GRID_SIZE = 128;
export const CELL_SIZE = 1 / GRID_SIZE;
/** Solver steps per rendered frame. */
export const SUBSTEPS_PER_FRAME = 50;
/** Solver time step in seconds, small enough for the stiffness range in `settings.ts`. */
export const TIME_STEP = 2e-4;
/** Grid sums are accumulated as `i32` through `atomicAdd`, so floats are scaled by this. */
export const FIXED_POINT_SCALE = 2 ** 16;
/** Particles per cell side; the stress term in the shader assumes four per cell. */
const PARTICLES_PER_CELL_SIDE = 2;
export const PARTICLE_SPACING = CELL_SIZE / PARTICLES_PER_CELL_SIDE;

/**
 * Floats per particle, matching the WGSL `Particle` struct:
 * x(2) v(2) C(4, column-major) J(1) + 1 padding to the 8-byte struct alignment.
 */
export const PARTICLE_STRIDE = 10;
export const OFFSET_X = 0;
export const OFFSET_V = 2;
export const OFFSET_J = 8;

/** Radius of the pointer's influence, as a fraction of the domain. */
export const POINTER_RADIUS = 0.12;
/** Pointer acceleration at its centre, in domain units per second squared. */
export const POINTER_ACCELERATION = 80;
