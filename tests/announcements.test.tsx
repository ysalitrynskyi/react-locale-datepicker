import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP Track 5 announcements. Each case guards a specific way a screen
 * reader can be left with less than the sighted user has.
 */
describe("announcements: month and year heading", () => {
  it("announces the visible month politely and atomically", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const live = h.dialog().querySelector('[data-part="live-region"]')!;
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(
      live.getAttribute("aria-atomic"),
      "the heading must be atomic — without it a reader announces only the changed fragment, e.g. a bare year",
    ).toBe("true");
    expect(live.textContent).toContain("2026");
  });

  it("re-announces the whole heading after navigation", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 11, 15), // December, so next crosses a year
    });
    await h.openViaClick();
    const live = () =>
      h.dialog().querySelector('[data-part="live-region"]')!.textContent ?? "";
    expect(live()).toContain("2026");
    fireEvent.click(h.headerNext());
    // The fragment that changed is the year; atomic means month goes with it.
    const after = live();
    expect(after).toContain("2027");
    expect(
      after.replace(/[\d\s]/g, "").length,
      "the month name must stay in the announced string, not just the year",
    ).toBeGreaterThan(0);
  });
});
