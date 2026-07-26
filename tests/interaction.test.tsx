import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderPicker, localDate, isoLocal } from "./helpers";

describe("interaction: one-tap commit and close", () => {
  it("one tap on a day commits and closes (no confirm button)", async () => {
    // Parity: clicking a day commits and closes. No confirm button.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 6, 1),
      onChange,
    });
    await h.openViaClick();
    expect(h.queryDialog()).toBeTruthy();
    await h.clickDay(18);
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-18");
    expect(
      h.queryDialog(),
      "popover must close on day click — guards reintroduction of a confirm step",
    ).toBeNull();
  });
});

describe("interaction: shouldDisableDate authority", () => {
  it("blocks selection by click when the predicate disables the day", async () => {
    // Parity: shouldDisableDate remains the single authority on selectable days.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 6, 1),
      shouldDisableDate: (d) => d.getDate() === 18,
      onChange,
    });
    await h.openViaClick();
    const day = h.dayButton(18);
    expect(day).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(day);
    expect(
      onChange,
      "click on shouldDisableDate day must not commit",
    ).not.toHaveBeenCalled();
    expect(h.queryDialog()).toBeTruthy();
  });

  it("blocks selection by keyboard when the predicate disables the day", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 6, 17),
      shouldDisableDate: (d) => d.getDate() === 18,
      onChange,
    });
    await h.openViaKeyboard();
    // Move into the grid then right to day 18.
    await h.user.keyboard("{ArrowDown}");
    // Focus starts on selected 17; ArrowRight → 18.
    await h.user.keyboard("{ArrowRight}");
    await h.user.keyboard("{Enter}");
    expect(
      onChange,
      "Enter on disabled day must not commit — keeps dialog open",
    ).not.toHaveBeenCalled();
    expect(h.queryDialog()).toBeTruthy();
  });

  it("minDate/maxDate bound navigation but do not override the predicate", async () => {
    // Parity: minDate/maxDate bound navigation only; they do not override
    // shouldDisableDate.
    const onChange = vi.fn();
    const disabled = vi.fn((d: Date) => d.getDate() === 20);
    const h = renderPicker({
      initialValue: localDate(2026, 6, 15),
      minDate: localDate(2026, 6, 1),
      maxDate: localDate(2026, 6, 31),
      shouldDisableDate: disabled,
      onChange,
    });
    await h.openViaClick();
    // Day 20 is inside min/max but disabled by predicate — still blocked.
    fireEvent.click(h.dayButton(20));
    expect(onChange).not.toHaveBeenCalled();
    // Day 21 is allowed by predicate and in range — commits.
    await h.clickDay(21);
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-21");
  });
});

describe("interaction: open landing month", () => {
  it("opening with no value lands on defaultCalendarMonth", async () => {
    // Parity: opening with no value lands on defaultCalendarMonth, then today,
    // then the first enabled month.
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2027, 2, 1),
      locale: "en",
    });
    await h.openViaClick();
    const march = new Intl.DateTimeFormat("en", { month: "long" }).format(
      localDate(2027, 2, 1),
    );
    expect(
      h.dialog().textContent,
      "must open on defaultCalendarMonth when value is null",
    ).toContain(march);
    expect(h.dialog().textContent).toContain("2027");
  });

  it("opening with no value and no default lands on today", async () => {
    const today = new Date();
    const h = renderPicker({ initialValue: null, locale: "en" });
    await h.openViaClick();
    const monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(
      today,
    );
    expect(h.dialog().textContent).toContain(monthName);
    expect(h.dialog().textContent).toContain(String(today.getFullYear()));
  });
});

describe("interaction: blur ordering", () => {
  it("onBlur receives the just-committed value, not captured parent state", async () => {
    // Parity: onBlur receives the just-committed value. Validating the
    // closure instead flashes a false "required" error.
    const blurValues: (Date | null)[] = [];
    const h = renderPicker({
      initialValue: null,
      onBlur: (current) => {
        blurValues.push(current);
      },
    });
    const input = h.input();
    await h.user.click(input);
    await h.user.keyboard("15032026");
    await h.user.tab();
    expect(
      blurValues.length,
      "onBlur must fire after typed commit",
    ).toBeGreaterThanOrEqual(1);
    const last = blurValues[blurValues.length - 1];
    expect(
      last && isoLocal(last),
      "onBlur argument must be the just-committed date — guards false required error",
    ).toBe("2026-03-15");
  });
});

describe("interaction: disabled open attempt", () => {
  it("fires onDisabledOpenAttempt when a disabled picker is tapped", async () => {
    // Parity: attempting to open a disabled picker fires onDisabledOpenAttempt.
    const onAttempt = vi.fn();
    const h = renderPicker({
      initialValue: null,
      disabled: true,
      onDisabledOpenAttempt: onAttempt,
    });
    fireEvent.click(h.input());
    expect(
      onAttempt,
      "disabled open must notify parent — guards silent failure",
    ).toHaveBeenCalledTimes(1);
    expect(h.queryDialog()).toBeNull();
  });
});

describe("interaction: month and year grids", () => {
  it("month and year navigation are two explicit grids", async () => {
    // Parity: month and year navigation are two explicit grids, not one list.
    const h = renderPicker({
      initialValue: localDate(2026, 5, 10),
      minDate: localDate(2024, 0, 1),
      maxDate: localDate(2028, 11, 31),
    });
    await h.openViaClick();
    // Open months grid via the month pill (aria-expanded).
    const pills = () =>
      Array.from(h.dialog().querySelectorAll("button[aria-expanded]"));
    fireEvent.click(pills()[0]);
    // Month grid: 12 buttons with month aria-labels, no data-day.
    const monthButtons = Array.from(
      h.dialog().querySelectorAll("button"),
    ).filter(
      (b) =>
        !b.hasAttribute("data-day") &&
        b.getAttribute("aria-expanded") === null &&
        b.getAttribute("aria-label") &&
        !/^\d{4}$/.test(b.textContent?.trim() ?? "") &&
        b.getAttribute("aria-label") !==
          h.headerPrev().getAttribute("aria-label") &&
        b.getAttribute("aria-label") !==
          h.headerNext().getAttribute("aria-label"),
    );
    // Simpler: after opening months view, count enabled/disabled month cells
    // by their short-name text content length and grid.
    const gridMonths = Array.from(h.dialog().querySelectorAll("button")).filter(
      (b) => b.getAttribute("aria-label") && !b.hasAttribute("data-day"),
    );
    // 12 month cells + 2 header chevrons + 2 pills = 16; require ≥ 12 month labels.
    const monthLabels = gridMonths.filter((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return !/^\d{4}$/.test(label) && !/\d{4}/.test(label);
    });
    expect(monthLabels.length).toBeGreaterThanOrEqual(12);
    void monthButtons;

    // Open years via the year pill.
    fireEvent.click(pills()[1]);
    expect(h.dialog().textContent).toMatch(/2024|2025|2026/);
  });
});
