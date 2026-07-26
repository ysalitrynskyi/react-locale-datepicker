import { defineConfig } from "tsup";

// Library build per docs/DECISIONS.md D6: ESM + CJS + .d.ts, no UMD.
// Styles path is intentionally omitted until D3 settles the stylesheet.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Keep React external — peer dependency, not bundled.
  external: ["react", "react-dom", "react/jsx-runtime"],
  treeshake: true,
  target: "es2020",
  outDir: "dist",
  // dual package: emit .cjs for require() consumers under "type": "module"
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
