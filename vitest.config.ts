import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e-tests/**"],
    projects: [
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: ["./src/test-setup.ts"],
          include: ["src/**/*.{test,spec}.{js,ts,tsx}"],
        },
      },
      {
        test: {
          name: "node",
          include: ["*.{test,spec}.{js,ts}"],
        },
      },
    ],
    coverage: {
      // json + json-summary feed the coverage report action in CI.
      reporter: ["text", "html", "json", "json-summary"],
      reportOnFailure: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.*",
        "src/**/*.d.ts",
        "src/test-setup.ts",
        "src/main.tsx",
        // Needs a real WebGPU device; e2e-tests/index.spec.ts drives it.
        "src/SimulationCanvas.tsx",
        "src/sim/gpu/**",
      ],
      thresholds: {
        autoUpdate: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
