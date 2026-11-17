import { defineConfig, devices } from "@playwright/test";

import { isPreviewTarget } from "./e2e-tests/target";
import { localServerURL } from "./port";

const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e-tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: "list",
  use: {
    baseURL: localServerURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The default headless shell only has a software GPU, which cannot present a WebGPU canvas.
        channel: "chromium",
        launchOptions: { args: ["--enable-unsafe-webgpu"] },
      },
    },
  ],
  webServer: {
    command: isPreviewTarget
      ? "pnpm run build && pnpm run preview"
      : "pnpm run dev",
    url: localServerURL,
    timeout: 180_000,
    // Dev and preview share the port; reusing one would test the wrong runtime.
    reuseExistingServer: false,
  },
});
