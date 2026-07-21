import { defineConfig } from "vite";

/**
 * Dev-only API proxy target. Defaults to the local server; set
 * `FITMIND_DEV_API_TARGET` to point the dev client at a deployed API instead
 * (useful when the local machine cannot reach the database directly).
 */
const devApiTarget =
  process.env.FITMIND_DEV_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
