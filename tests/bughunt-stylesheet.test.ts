// @vitest-environment node
// Stylesheet guards that no current browser can exercise: a browser without
// light-dark() is needed to see BH-023, so its fallback is pinned
// structurally. Ledger: docs/bug-hunts/2026-09-30.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const block = (source: string, opener: string): string => {
  const start = source.indexOf(opener);
  if (start < 0) return "";
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  return "";
};

describe("named themes degrade where light-dark() is unsupported (BH-023)", () => {
  const fallback = block(css, "@supports not (color: light-dark(#000, #fff))");

  it("the fallback block exists", () => {
    expect(fallback).not.toBe("");
  });

  it.each([
    "--rldp-background",
    "--rldp-foreground",
    "--rldp-surface",
    "--rldp-accent",
    "--rldp-accent-foreground",
    "--rldp-border",
  ])("resets the named themes' %s so the plain fallback applies", (token) => {
    const themes = block(fallback, ":where([data-rldp-theme])");
    expect(themes).toMatch(new RegExp(`${token}: initial;`));
  });
});

describe("no text-transform rewrites Intl's casing (BH-036)", () => {
  it("capitalize is gone from the stylesheet", () => {
    expect(css).not.toMatch(/text-transform:\s*capitalize/);
  });
});
