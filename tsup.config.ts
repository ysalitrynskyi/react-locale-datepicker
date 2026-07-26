import { defineConfig } from "tsup";

// Library build per docs/DECISIONS.md D6: ESM + CJS + .d.ts, no UMD.
// The stylesheet (D3) is copied verbatim — it is plain CSS, no build step.
export default defineConfig({
  onSuccess: "cp src/styles.css dist/styles.css",
  // The component uses hooks, so React Server Components consumers need the
  // client boundary marked in the shipped bundle.
  banner: { js: '"use client";' },
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Keep React external — peer dependency, not bundled.
  external: ["react", "react-dom", "react/jsx-runtime"],
  // No rollup treeshake pass: it strips the "use client" directive (module
  // level directives are dropped when rollup bundles). esbuild's own dead
  // code elimination is sufficient for a single-entry library, and consumer
  // tree-shaking is governed by sideEffects in package.json.
  target: "es2020",
  outDir: "dist",
  // dual package: emit .cjs for require() consumers under "type": "module"
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
