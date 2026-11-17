import {
  CELL_SIZE,
  FIXED_POINT_SCALE,
  GRID_SIZE,
  MATERIAL_SOLID,
  PARTICLE_SPACING,
} from "../params";

/** A float literal WGSL always parses as `f32`, never as an integer. */
const f = (value: number): string => value.toPrecision(9);

const COMMON = /* wgsl */ `
struct Params {
  gravity: vec2f,
  pointer: vec2f,
  stiffness: f32,
  dt: f32,
  count: u32,
  pointerRadius: f32,
  pointerAccel: f32,
  solidStiffness: f32,
}

struct Particle {
  x: vec2f,
  v: vec2f,
  c: mat2x2f,
  j: f32,
  material: f32,
  f: mat2x2f,
}

const GRID: u32 = ${String(GRID_SIZE)}u;
const CELLS: u32 = ${String(GRID_SIZE * GRID_SIZE)}u;
const GRID_F: f32 = ${f(GRID_SIZE)};
const DX: f32 = ${f(CELL_SIZE)};
const INV_DX: f32 = ${f(GRID_SIZE)};
const FIXED: f32 = ${f(FIXED_POINT_SCALE)};
const SOLID: f32 = ${f(MATERIAL_SOLID)};

fn isSolid(p: Particle) -> bool {
  return p.material > 0.5 * SOLID;
}
`;

export const COMPUTE_SHADER = /* wgsl */ `
${COMMON}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
// Per cell: mass, momentum x, momentum y, as fixed-point i32 so atomicAdd can sum them.
@group(0) @binding(2) var<storage, read_write> grid: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> gridVelocity: array<vec2f>;

const MIN_DET: f32 = 0.1;

fn rotationOf(f: mat2x2f) -> mat2x2f {
  let cosine = f[0][0] + f[1][1];
  let sine = f[0][1] - f[1][0];
  let norm = length(vec2f(cosine, sine));
  if (norm < 1e-6) { return mat2x2f(1.0, 0.0, 0.0, 1.0); }
  return mat2x2f(cosine / norm, sine / norm, -sine / norm, cosine / norm);
}

// Fixed corotated elasticity, Kirchhoff stress P F^T, with equal Lame parameters.
fn solidStress(f: mat2x2f) -> mat2x2f {
  let j = determinant(f);
  let volumetric = params.solidStiffness * (j - 1.0) * j;
  return 2.0 * params.solidStiffness * (f - rotationOf(f)) * transpose(f)
    + mat2x2f(volumetric, 0.0, 0.0, volumetric);
}

fn keepInvertible(f: mat2x2f) -> mat2x2f {
  if (determinant(f) >= MIN_DET) { return f; }
  return sqrt(MIN_DET) * rotationOf(f);
}

// Quadratic B-spline weights of the three grid nodes a particle touches, per axis.
fn weights(fx: vec2f) -> array<vec2f, 3> {
  return array<vec2f, 3>(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5),
  );
}

@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= CELLS) { return; }
  atomicStore(&grid[3u * id.x], 0);
  atomicStore(&grid[3u * id.x + 1u], 0);
  atomicStore(&grid[3u * id.x + 2u], 0);
}

// Particle to grid: scatter mass and affine momentum (MLS-MPM), unit particle mass.
@compute @workgroup_size(64)
fn particleToGrid(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.count) { return; }
  let p = particles[id.x];
  let xg = p.x * GRID_F;
  let base = vec2i(floor(xg - 0.5));
  let fx = xg - vec2f(base);
  var w = weights(fx);

  var kirchhoff = mat2x2f(0.0, 0.0, 0.0, 0.0);
  if (isSolid(p)) {
    kirchhoff = solidStress(p.f);
  } else {
    let pressure = params.stiffness * (p.j - 1.0);
    kirchhoff = mat2x2f(pressure, 0.0, 0.0, pressure);
  }
  let affine = (-params.dt * 4.0 * INV_DX * INV_DX) * kirchhoff + p.c;

  for (var a = 0; a < 3; a++) {
    for (var b = 0; b < 3; b++) {
      let dpos = (vec2f(f32(a), f32(b)) - fx) * DX;
      let weight = w[a].x * w[b].y;
      let momentum = weight * (p.v + affine * dpos);
      let cell = vec2u(base + vec2i(a, b));
      let index = 3u * (cell.y * GRID + cell.x);
      atomicAdd(&grid[index], i32(round(weight * FIXED)));
      atomicAdd(&grid[index + 1u], i32(round(momentum.x * FIXED)));
      atomicAdd(&grid[index + 2u], i32(round(momentum.y * FIXED)));
    }
  }
}

// Grid update: momentum to velocity, then gravity, the pointer and the walls.
@compute @workgroup_size(64)
fn updateGrid(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= CELLS) { return; }
  let mass = f32(atomicLoad(&grid[3u * i])) / FIXED;
  var v = vec2f(0.0);
  if (mass > 0.0) {
    v = vec2f(f32(atomicLoad(&grid[3u * i + 1u])), f32(atomicLoad(&grid[3u * i + 2u]))) / (FIXED * mass);
    v += params.dt * params.gravity;

    let node = vec2f(f32(i % GRID), f32(i / GRID));
    let toPointer = params.pointer - node * DX;
    let distance = length(toPointer);
    if (distance < params.pointerRadius && distance > 1e-5) {
      v += params.dt * params.pointerAccel * (toPointer / distance) * (1.0 - distance / params.pointerRadius);
    }

    // Three-cell walls: no velocity into the boundary.
    let x = i % GRID;
    let y = i / GRID;
    if ((x < 3u && v.x < 0.0) || (x > GRID - 3u && v.x > 0.0)) { v.x = 0.0; }
    if ((y < 3u && v.y < 0.0) || (y > GRID - 3u && v.y > 0.0)) { v.y = 0.0; }
  }
  gridVelocity[i] = v;
}

// Grid to particle: gather velocity and the affine matrix, then advect.
@compute @workgroup_size(64)
fn gridToParticle(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.count) { return; }
  var p = particles[id.x];
  let xg = p.x * GRID_F;
  let base = vec2i(floor(xg - 0.5));
  let fx = xg - vec2f(base);
  var w = weights(fx);

  var velocity = vec2f(0.0);
  var c = mat2x2f(0.0, 0.0, 0.0, 0.0);
  for (var a = 0; a < 3; a++) {
    for (var b = 0; b < 3; b++) {
      let dpos = vec2f(f32(a), f32(b)) - fx;
      let cell = vec2u(base + vec2i(a, b));
      let gv = gridVelocity[cell.y * GRID + cell.x];
      let weight = w[a].x * w[b].y;
      velocity += weight * gv;
      c += (4.0 * INV_DX * weight) * mat2x2f(gv * dpos.x, gv * dpos.y);
    }
  }

  p.v = velocity;
  p.c = c;
  // Keeps the 3x3 stencil inside the grid even if a particle slips into the wall cells.
  p.x = clamp(p.x + params.dt * velocity, vec2f(2.0 * DX), vec2f(1.0 - 2.0 * DX));
  if (isSolid(p)) {
    p.f = keepInvertible((mat2x2f(1.0, 0.0, 0.0, 1.0) + params.dt * c) * p.f);
  } else {
    p.j = p.j * (1.0 + params.dt * (c[0][0] + c[1][1]));
  }
  particles[id.x] = p;
}
`;

export const RENDER_SHADER = /* wgsl */ `
${COMMON}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;

struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,
  @location(1) speed: f32,
  @location(2) @interpolate(flat) solid: f32,
}

const RADIUS: f32 = ${f(PARTICLE_SPACING * 1.5)};

@vertex
fn vertexMain(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Vertex {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corner = corners[vi];
  let p = particles[ii];
  // The domain is [0,1]^2; clip space is [-1,1]^2 with y up, like the domain.
  let centre = p.x * 2.0 - 1.0;
  var out: Vertex;
  out.position = vec4f(centre + corner * RADIUS * 2.0, 0.0, 1.0);
  out.corner = corner;
  out.speed = length(p.v);
  out.solid = select(0.0, 1.0, isSolid(p));
  return out;
}

@fragment
fn fragmentMain(in: Vertex) -> @location(0) vec4f {
  let r = length(in.corner);
  if (r > 1.0) { discard; }
  let t = clamp(in.speed / 4.0, 0.0, 1.0);
  let fluid = mix(vec3f(0.12, 0.42, 0.95), vec3f(0.85, 0.97, 1.0), t);
  let solid = mix(vec3f(0.95, 0.5, 0.1), vec3f(1.0, 0.9, 0.55), t);
  let colour = mix(fluid, solid, in.solid);
  return vec4f(colour * (1.0 - 0.25 * r * r), 1.0);
}
`;
