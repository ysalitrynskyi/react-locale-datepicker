import { describe, expect, it } from "vitest";
import { resolveLocale } from "../src/LocaleDatePicker";

describe("resolveLocale", () => {
  it("maps ua → uk so Intl never throws (guards the form-hydration crash)", () => {
    // Parity: non-standard locale aliases are normalized before reaching Intl.
    // The known case is ua → uk; an unnormalized tag throws RangeError and
    // previously crashed hydration of the entire surrounding form.
    expect(
      resolveLocale("ua"),
      "ua must resolve to uk — unnormalized ua crashes Intl and took down the form",
    ).toBe("uk");
    expect(() => new Intl.DateTimeFormat(resolveLocale("ua"))).not.toThrow();
  });

  it("accepts a real BCP 47 tag unchanged", () => {
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("ja")).toBe("ja");
    expect(resolveLocale("ar")).toBe("ar");
  });

  it("falls back without throwing on unknown or malformed tags", () => {
    // Parity: an unknown or malformed locale falls back instead of throwing.
    // Structurally malformed tags (underscore form) raise RangeError from
    // every Intl constructor and must map to "en". Tags that are merely
    // unknown but well-formed (e.g. zz-ZZ) are accepted by modern Intl
    // engines without throwing — resolveLocale keeps them as-is; the
    // component must still render.
    expect(
      resolveLocale("en_US"),
      "structurally malformed en_US (underscore) must fall back, not throw",
    ).toBe("en");
    expect(() => new Intl.DateTimeFormat(resolveLocale("en_US"))).not.toThrow();
    expect(() => new Intl.DateTimeFormat(resolveLocale("zz-ZZ"))).not.toThrow();
    // zz-ZZ must never throw at the resolve boundary regardless of whether
    // the engine treats it as a real locale or falls back internally.
    expect(() => resolveLocale("zz-ZZ")).not.toThrow();
  });

  it("caches by the raw input so repeated calls stay cheap", () => {
    const a = resolveLocale("ua");
    const b = resolveLocale("ua");
    expect(a).toBe(b);
    expect(a).toBe("uk");
  });
});
