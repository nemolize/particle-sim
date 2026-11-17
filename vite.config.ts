import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { localServerPort } from "./port.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: localServerPort,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
  },
  preview: {
    port: localServerPort,
    strictPort: true,
  },
});
