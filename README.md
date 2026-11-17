# Particle Sim

A 2D particle simulation that runs on the GPU in the browser, using WebGPU
compute shaders. It solves a weakly compressible fluid with MLS-MPM (the moving
least squares material point method) and draws every particle as a point sprite
straight from the solver's buffer, so particles never travel back to the CPU for
rendering.

## What it models

- **MLS-MPM** — particles carry mass, velocity, an affine velocity matrix and the
  volume ratio `J`. Each step scatters them to a 128x128 grid, updates the grid,
  and gathers the result back.
- **Fluid** — pressure comes from `J` and a stiffness you can change at run time.
- **Grid transfer on the GPU** — the scatter uses `atomicAdd` on fixed-point
  `i32` values, so particles need no sorting.

Known limit: there is one material, a water-like fluid. Solids, sand and snow
need a deformation gradient per particle, which is not stored yet.

## Using it

Pick a scene (a dam break, a drop into a pool, or two colliding blobs), then
press and drag on the canvas to attract or repel the particles. The side panel
changes stiffness and gravity, pauses, and resets; its statistics are read back
from the GPU a few times per second.

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
