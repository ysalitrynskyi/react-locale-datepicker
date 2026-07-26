import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // Unit suite is also re-run under TZ=UTC / America/Los_Angeles / Asia/Tokyo
    // in CI — see package.json scripts and .github/workflows/ci.yml.
    css: false,
  },
});
