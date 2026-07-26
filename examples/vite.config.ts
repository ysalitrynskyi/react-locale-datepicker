import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The repository is served from a project page, not a user page, so the
  // site lives under /<repo>/ rather than at the domain root.
  base: "/react-locale-datepicker/",
  resolve: {
    // Load-bearing, not tidy-up. The package is installed as `file:..`,
    // which npm symlinks, so the linked package resolves React from the
    // repository root while this app resolves its own copy. Two Reacts in
    // one tree is an immediate "invalid hook call" crash.
    dedupe: ["react", "react-dom"],
  },
});
