import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * Regression for ROADMAP Track 5 voice-control defect: day-cell accessible
 * names began with the weekday, so "click 18" style commands failed. The
 * day number must come first.
 */
describe("day-cell accessible names lead with the day number", () => {
  it("aria-label on a day button starts with the calendar day number", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 1),
    });
    await h.openViaClick();
    const day18 = h.dayButton(18);
    const label = day18.getAttribute("aria-label") ?? "";
    expect(
      label,
      'day aria-label must start with the day number so voice control "click 18" matches',
    ).toMatch(/^18\b/);
    // Still descriptive: includes weekday/month/year material.
    expect(label.length).toBeGreaterThan(3);
  });

  it("does not lead with a weekday name (en)", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 1),
    });
    await h.openViaClick();
    const day18 = h.dayButton(18);
    const label = day18.getAttribute("aria-label") ?? "";
    // The previous format was fullDateFmt, which for en starts with weekday.
    const weekdayFirst = new Intl.DateTimeFormat("en", {
      calendar: "gregory",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(localDate(2026, 6, 18));
    expect(
      label.startsWith(weekdayFirst.split(",")[0]),
      "day aria-label must not lead with the weekday (old fullDateFmt order)",
    ).toBe(false);
    expect(label.startsWith("18")).toBe(true);
  });
});
