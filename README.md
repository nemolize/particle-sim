# Particle Sim

A 2D particle simulation that runs on the GPU in the browser, using WebGPU
compute shaders. It solves a weakly compressible fluid and elastic solids with
MLS-MPM (the moving least squares material point method) and draws every
particle as a point sprite straight from the solver's buffer, so particles never
travel back to the CPU for rendering.

## What it models

- **MLS-MPM** — particles carry mass, velocity, an affine velocity matrix, a
  material, the volume ratio `J` and a 2x2 deformation gradient `F`. Each step
  scatters them to a 128x128 grid, updates the grid, and gathers the result back.
- **Fluid** — pressure comes from `J` and a stiffness you can change at run time.
- **Elastic solid** — stress comes from `F` through the fixed corotated model, with
  its own stiffness you can change at run time. Fluid and solid share the grid, so
  they push on each other. Orange particles are solid, blue ones fluid.
- **Grid transfer on the GPU** — the scatter uses `atomicAdd` on fixed-point
  `i32` values, so particles need no sorting.

Known limit: the only solid is elastic. It recovers its shape, but it cannot yield,
crack or flow, so plasticity, sand, snow and fracture are not modelled. A solid
whose `F` would become singular or inverted is reset to a pure compression, so the
solver does not diverge, but such a particle forgets its shear. Solids and fluid
have equal density, so a solid in a pool is neutrally buoyant.

## Using it

Pick a scene (a dam break, a drop into a pool, two colliding blobs, an elastic
block landing on the floor, or a block dropped into a pool, straight or tilted), then
press and drag on the canvas to attract or repel the particles. The side panel
changes the fluid and solid stiffness and gravity, pauses, and resets; its statistics are read back
from the GPU a few times per second.

On a phone or tablet, tilting the device tilts gravity and shaking it pushes the
fluid, the canvas acting as a container fixed to the screen. The `Motion` toggle
in the side panel appears on a device that delivers sensor data and turns this
off. It starts on where data already arrives; iOS Safari delivers none until you
turn it on and allow motion access. The browser only delivers sensor data to a
secure context (HTTPS or `localhost`). The `Gravity`
slider keeps its meaning as the strength of 1 g.

It needs a browser with WebGPU, such as a recent Chrome, Edge or Safari. Without
it the page says so instead of drawing.

## Development

Built from [`nemolize/web-app-template`](https://github.com/nemolize/web-app-template):
React, Vite, Tailwind, Vitest, Playwright and Cloudflare Workers hosting.

```bash
mise install
pnpm install
pnpm dev
```

| Command                           | What it does                                |
| --------------------------------- | ------------------------------------------- |
| `pnpm run lint`                   | ESLint, type checks, Prettier, knip, zizmor |
| `pnpm run test`                   | Unit tests                                  |
| `pnpm run test:coverage`          | Unit tests with the 100% coverage threshold |
| `pnpm run test:e2e`               | Playwright against the dev server           |
| `E2E_PREVIEW=1 pnpm run test:e2e` | Playwright against the production build     |

The solver is in `src/sim`: the WGSL shaders and the WebGPU `Simulator` are in
`src/sim/gpu`, and the React layer around it is `src/App.tsx`,
`src/ControlPanel.tsx` and `src/SimulationCanvas.tsx`. Those GPU files are not
covered by unit tests; the end-to-end tests run them where the browser has
WebGPU and skip otherwise.

## Deployment

Deployment follows the template: `.github/workflows/deploy.yml` deploys `main` to
a Cloudflare Worker named `particle-sim`. It needs the `production` and `preview`
environments with a `CLOUDFLARE_API_TOKEN` each, as described in the template's
README under "After using this template". Until those exist the Deploy job fails.

## License

MIT
