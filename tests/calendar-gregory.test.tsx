import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * Regression for D11 / ROADMAP Track 4 defect: locale-default calendars
 * (islamic-umalqura for ar-SA, Buddhist for th-TH) must not make the
 * long-form echo disagree with the Gregorian grid.
 */
describe("echo calendar is pinned to gregory (D11)", () => {
  const value = localDate(2026, 6, 18); // 18 July 2026 Gregorian

  it("ar-SA echo uses Gregorian year 2026, not Hijri", () => {
    // Without calendar:"gregory", Intl ar-SA formats this as a Hijri date
    // (e.g. صفر ١٤٤٨) against a Gregorian grid — echo and grid disagreed.
    const h = renderPicker({ locale: "ar-SA", initialValue: value });
    const expected = new Intl.DateTimeFormat("ar-SA", {
      calendar: "gregory",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
    expect(
      h.container.textContent,
      "ar-SA echo must match gregory-pinned Intl — guards Hijri echo vs Gregorian grid",
    ).toContain(expected);
    expect(
      h.container.textContent,
      "ar-SA echo must contain Gregorian year 2026, not a Hijri year",
    ).toMatch(/2026|٢٠٢٦/);
    // Hijri year for this date is 1448; must not appear as the year token.
    const unpinned = new Intl.DateTimeFormat("ar-SA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
    if (unpinned !== expected) {
      expect(
        h.container.textContent,
        "ar-SA echo must not equal the unpinned (islamic-umalqura) format",
      ).not.toContain(unpinned);
    }
  });

  it("th-TH echo uses Gregorian year 2026, not Buddhist 2569", () => {
    // Without calendar:"gregory", th-TH echoes Buddhist era year 2569.
    const h = renderPicker({ locale: "th-TH", initialValue: value });
    const expected = new Intl.DateTimeFormat("th-TH", {
      calendar: "gregory",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
    expect(
      h.container.textContent,
      "th-TH echo must match gregory-pinned Intl — guards Buddhist-era echo",
    ).toContain(expected);
    expect(
      h.container.textContent,
      "th-TH echo must contain Gregorian 2026, not Buddhist 2569",
    ).toContain("2026");
    expect(
      h.container.textContent,
      "th-TH echo must not contain Buddhist era year 2569",
    ).not.toContain("2569");
  });
});
