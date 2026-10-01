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

  /**
   * Assert the key landed FOCUS on the destination cell, not just the roving
   * tabindex. The two are separate mechanisms: tabindex="0" follows focusDay
   * during render, while real DOM focus comes from an effect that runs after
   * it. On PageUp/PageDown that effect is what focuses the new cell at all, and
   * on Home/End it is what takes focus off the old one, so a check of tabindex
   * alone stays green with the effect deleted — the keyboard user is then left
   * on the wrong day, or on nothing.
   */
  function expectFocusOn(
    h: ReturnType<typeof renderPicker>,
    dayKey: string,
    why: string,
  ) {
    const target = h.dialog().querySelector(`[data-day="${dayKey}"]`);
    expect(target, why).toBeTruthy();
    expect(target).toHaveAttribute("tabindex", "0");
    expect(
      document.activeElement,
      `${why} — DOM focus must be on ${dayKey}, not only its tabindex`,
    ).toBe(target);
  }

  it("PageDown moves focus one month forward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15), // 15 June
      locale: "en",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{PageDown}");
    // July 15 should be the roving/focused day.
    expectFocusOn(
      h,
      "2026-6-15",
      "PageDown must advance one month — guards missing Page key map",
    );
  });

  it("PageUp moves focus one month backward", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{PageUp}");
    expectFocusOn(
      h,
      "2026-4-15",
      "PageUp must step one month back — guards missing Page key map",
    );
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
    expectFocusOn(
      h,
      "2027-5-15",
      "Shift+PageDown must advance one year — guards missing year Page map",
    );
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
    expectFocusOn(
      h,
      "2025-5-15",
      "Shift+PageUp must step one year back — guards missing year Page map",
    );
  });

  it("Home moves to the start of the locale week", async () => {
    // 15 June 2026 is a Monday. en-US week starts Sunday → Home = 14 June.
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en-US",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{Home}");
    expectFocusOn(
      h,
      "2026-5-14",
      "Home must land on the locale week start — guards missing Home key",
    );
  });

  it("End moves to the end of the locale week", async () => {
    // 15 June 2026 Monday; en-US week ends Saturday 20 June.
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      locale: "en-US",
    });
    await focusGridOn(h, 15);
    await h.user.keyboard("{End}");
    expectFocusOn(
      h,
      "2026-5-20",
      "End must land on the locale week end — guards missing End key",
    );
  });
});
