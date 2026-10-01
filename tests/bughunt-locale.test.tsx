// Regression guards for the 2026-09-30 bug hunt, locale half. Each test names
// the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import { describe, expect, it } from "vitest";
import { resolveLocale } from "../src/LocaleDatePicker";

describe("resolveLocale matches the alias on the language subtag (BH-001)", () => {
  it.each([
    ["UA", "uk"],
    ["Ua", "uk"],
    ["uA", "uk"],
    ["ua-UA", "uk-UA"],
    ["UA-ua", "uk-UA"],
  ])("%s resolves to %s, not to a silently-English unknown tag", (raw, want) => {
    expect(resolveLocale(raw)).toBe(want);
    const month = new Intl.DateTimeFormat(resolveLocale(raw), {
      calendar: "gregory",
      month: "long",
    }).format(new Date(2026, 7, 12));
    expect(month, `${raw} must format in Ukrainian`).toBe("серпень");
  });

  it("canonicalizes case without changing a real tag's meaning", () => {
    expect(resolveLocale("de-de")).toBe("de-DE");
    expect(resolveLocale("EN")).toBe("en");
  });
});
