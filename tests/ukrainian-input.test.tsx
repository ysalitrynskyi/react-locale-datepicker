import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleDatePicker, resolveLocale, todayInTimeZone } from "../src/LocaleDatePicker";

/**
 * Ukrainian-locale input and calendar behaviour.
 *
 * The component's largest real audience types on a Cyrillic (ЙЦУКЕН) keyboard
 * against a Kyiv business calendar, and both of those have a way of producing a
 * silently wrong date rather than an obvious failure.
 */

function renderPicker(props: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  render(
    <LocaleDatePicker
      value={null}
      onChange={onChange}
      locale="uk"
      placeholder="dd.mm.yyyy"
      aria-label="Date"
      {...props}
    />,
  );
  return { onChange, input: () => screen.getByLabelText("Date") as HTMLInputElement };
}

describe("typing a date on a Cyrillic keyboard", () => {
  // On ЙЦУКЕН the physical QWERTY period and comma keys emit "ю" and "б".
  // Before the fix these were dropped as letters, the digits closed up, and
  // "1ю8ю2026" became "18.20.26" — a different date, displayed as if typed.
  it.each([
    ["ю as the period key", "1ю8ю2026"],
    ["б as the comma key", "1б8б2026"],
    ["uppercase Ю (caps lock)", "1Ю8Ю2026"],
    ["a plain space", "1 8 2026"],
    ["ASCII dot, for comparison", "1.8.2026"],
    ["ASCII comma, for comparison", "1,8,2026"],
  ])("%s pads single digits instead of running them together", (_label, typed) => {
    const h = renderPicker();
    fireEvent.change(h.input(), { target: { value: typed } });
    expect(
      h.input(),
      `"${typed}" must mask to 01.08.2026, never to a different date`,
    ).toHaveValue("01.08.2026");
  });

  it.each(["12ю08ю2026", "12 08 2026", "12.08.2026", "12,08,2026"])(
    "two-digit segments are unaffected by the separator used (%s)",
    (typed) => {
      const h = renderPicker();
      fireEvent.change(h.input(), { target: { value: typed } });
      expect(h.input()).toHaveValue("12.08.2026");
    },
  );

  it("interleaved editing junk is still stripped, not treated as separators", () => {
    // The opposite rule, and it has to keep holding: noise from mid-string
    // editing must let the digits close up. This is why the separator set is an
    // allowlist rather than "any non-digit".
    const h = renderPicker();
    fireEvent.change(h.input(), { target: { value: "1a5b0c3d2e0f2g8" } });
    expect(h.input()).toHaveValue("15.03.2028");
  });
});

describe("Ukrainian locale and the Kyiv business calendar", () => {
  it("resolves the non-standard 'ua' tag that Intl rejects", () => {
    // Passing "ua" straight to Intl throws a RangeError, which in the source
    // product crashed the hydration of an entire form.
    expect(resolveLocale("ua")).toBe("uk");
    expect(() => new Intl.DateTimeFormat(resolveLocale("ua"))).not.toThrow();
  });

  it("renders Ukrainian month names from Intl, with no bundled locale data", () => {
    renderPicker({ value: new Date(2026, 7, 12), locale: "ua" });
    // серпень = August. Proves the ua -> uk alias reaches the formatters.
    expect(document.body.textContent).toMatch(/серп/i);
  });

  it("derives today in Europe/Kyiv, not in the host timezone", () => {
    const kyiv = todayInTimeZone("Europe/Kyiv");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const num = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    expect(kyiv.getFullYear()).toBe(num("year"));
    expect(kyiv.getMonth()).toBe(num("month") - 1);
    expect(kyiv.getDate()).toBe(num("day"));
    // Local-midnight, per the timezone contract — never a UTC instant.
    expect([kyiv.getHours(), kyiv.getMinutes(), kyiv.getSeconds()]).toEqual([0, 0, 0]);
  });

  it("accepts the legacy Europe/Kiev spelling", () => {
    // Older systems and stored config still carry the pre-2022 IANA name.
    expect(() => todayInTimeZone("Europe/Kiev")).not.toThrow();
    expect(todayInTimeZone("Europe/Kiev").getDate()).toBe(
      todayInTimeZone("Europe/Kyiv").getDate(),
    );
  });

  it("falls back to the visitor's zone on an invalid timezone", () => {
    expect(() => todayInTimeZone("Not/AZone")).not.toThrow();
  });
});
