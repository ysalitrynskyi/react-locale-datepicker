import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * Regression for ROADMAP Track 5 keyboard-map gap: PageUp/PageDown (month),
 * Shift+PageUp/PageDown (year), Home/End (week bounds) were missing versus
 * the converged APG/Duet/Cally model.
 */
describe("grid keyboard map — Page/Home/End", () => {
  async function focusGridOn(h: ReturnType<typeof renderPicker>, day: number) {
    await h.openViaKeyboard();
    // Second ArrowDown enters the grid on the roving target (selected day).
    await h.user.keyboard("{ArrowDown}");
    const btn = h.dayButton(day);
    // Ensure focusDay is the intended day when it is already selected.
    btn.focus();
    expect(document.activeElement).toBe(btn);
  }

  it("PageDown moves focus one month forward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15), // 15 June
      locale: "en",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{PageDown}");
    // July 15 should be the roving/focused day.
    const july15 = h.dialog().querySelector('[data-day="2026-6-15"]');
    expect(
      july15,
      "PageDown must advance one month — guards missing Page key map",
    ).toBeTruthy();
    expect(july15).toHaveAttribute("tabindex", "0");
  });

  it("PageUp moves focus one month backward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{PageUp}");
    const may15 = h.dialog().querySelector('[data-day="2026-4-15"]');
    expect(
      may15,
      "PageUp must step one month back — guards missing Page key map",
    ).toBeTruthy();
    expect(may15).toHaveAttribute("tabindex", "0");
  });

  it("Shift+PageDown moves focus one year forward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en",
      minDate: localDate(2020, 0, 1),
      maxDate: localDate(2030, 11, 31),
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{Shift>}{PageDown}{/Shift}");
    const nextYear = h.dialog().querySelector('[data-day="2027-5-15"]');
    expect(
      nextYear,
      "Shift+PageDown must advance one year — guards missing year Page map",
    ).toBeTruthy();
    expect(nextYear).toHaveAttribute("tabindex", "0");
  });

  it("Shift+PageUp moves focus one year backward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en",
      minDate: localDate(2020, 0, 1),
      maxDate: localDate(2030, 11, 31),
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{Shift>}{PageUp}{/Shift}");
    const prevYear = h.dialog().querySelector('[data-day="2025-5-15"]');
    expect(
      prevYear,
      "Shift+PageUp must step one year back — guards missing year Page map",
    ).toBeTruthy();
    expect(prevYear).toHaveAttribute("tabindex", "0");
  });

  it("Home moves to the start of the locale week", async () => {
    // 15 June 2026 is a Monday. en-US week starts Sunday → Home = 14 June.
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en-US",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{Home}");
    const weekStart = h.dialog().querySelector('[data-day="2026-5-14"]');
    expect(
      weekStart,
      "Home must land on the locale week start — guards missing Home key",
    ).toBeTruthy();
    expect(weekStart).toHaveAttribute("tabindex", "0");
  });

  it("End moves to the end of the locale week", async () => {
    // 15 June 2026 Monday; en-US week ends Saturday 20 June.
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en-US",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{End}");
    const weekEnd = h.dialog().querySelector('[data-day="2026-5-20"]');
    expect(
      weekEnd,
      "End must land on the locale week end — guards missing End key",
    ).toBeTruthy();
    expect(weekEnd).toHaveAttribute("tabindex", "0");
  });
});
