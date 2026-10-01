import { describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/react";
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
      locale: "en",
      onChange,
    });
    await h.openViaKeyboard();
    const gridName = () =>
      within(h.dialog()).getByRole("grid").getAttribute("aria-label");
    const activeDay = () => document.activeElement?.getAttribute("data-day");

    // Bounded navigation, pointer half: the window is the month of July, so
    // both header chevrons already sit at their limit and must not be
    // pressable. A chevron that stays enabled is a way out of the range.
    expect(h.headerPrev(), "June is before minDate").toBeDisabled();
    expect(h.headerNext(), "August is after maxDate").toBeDisabled();

    // Bounded navigation, keyboard half. ArrowDown enters the grid on the
    // selected 15 July (data-day is month-indexed: July is 6).
    await h.user.keyboard("{ArrowDown}");
    expect(activeDay()).toBe("2026-6-15");

    // Upper bound: a key that would land past maxDate is swallowed, and both
    // the cursor and the visible month stay where they were.
    await h.user.keyboard("{PageDown}"); // 15 August: past maxDate
    expect(gridName(), "PageDown must not leave the allowed month").toBe(
      "July 2026",
    );
    expect(activeDay()).toBe("2026-6-15");
    await h.user.keyboard("{ArrowDown}{ArrowDown}"); // 22, then 29 July
    expect(activeDay()).toBe("2026-6-29");
    await h.user.keyboard("{ArrowDown}"); // 5 August: past maxDate
    expect(gridName(), "ArrowDown must not roll into August").toBe(
      "July 2026",
    );
    expect(activeDay()).toBe("2026-6-29");

    // Lower bound, the same two ways.
    await h.user.keyboard("{PageUp}"); // 29 June: before minDate
    expect(gridName(), "PageUp must not leave the allowed month").toBe(
      "July 2026",
    );
    expect(activeDay()).toBe("2026-6-29");
    await h.user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}"); // 22, 15, 8, 1
    expect(activeDay()).toBe("2026-6-1");
    await h.user.keyboard("{ArrowUp}"); // 24 June: before minDate
    expect(gridName(), "ArrowUp must not roll back into June").toBe(
      "July 2026",
    );
    expect(activeDay()).toBe("2026-6-1");

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
      locale: "en",
    });
    await h.openViaClick();
    // Looked up by published data-part: the grids are what the anatomy says
    // they are, wherever the DOM happens to nest them. Matching on dialog
    // text instead cannot work here — the header already prints "2026".
    const part = (name: string) =>
      h.dialog().querySelector(`[data-part="${name}"]`);
    const parts = (name: string) =>
      Array.from(h.dialog().querySelectorAll(`[data-part="${name}"]`));
    const label = (el: Element) => el.getAttribute("aria-label");

    // Days first: neither explicit grid is on screen yet.
    expect(part("grid"), "the calendar opens on the days grid").not.toBeNull();
    expect(part("months")).toBeNull();
    expect(part("years")).toBeNull();

    // The month pill swaps the days grid for twelve month buttons.
    const monthPill = part("month-pill")!;
    fireEvent.click(monthPill);
    expect(monthPill).toHaveAttribute("aria-expanded", "true");
    expect(
      part("months"),
      "the month pill must open a months grid",
    ).not.toBeNull();
    expect(part("grid"), "the months grid replaces the days grid").toBeNull();
    expect(part("years")).toBeNull();
    expect(
      parts("year"),
      "two explicit grids, not one list: no years among the months",
    ).toHaveLength(0);
    const monthNames = Array.from({ length: 12 }, (_, m) =>
      new Intl.DateTimeFormat("en", { month: "long" }).format(
        localDate(2026, m, 15),
      ),
    );
    expect(parts("month").map(label)).toEqual(monthNames);
    expect(
      parts("month")
        .filter((b) => b.hasAttribute("data-current"))
        .map(label),
      "the visible month (June) is the current one",
    ).toEqual(["June"]);

    // The year pill swaps that for a years grid spanning minDate..maxDate.
    const yearPill = part("year-pill")!;
    fireEvent.click(yearPill);
    expect(yearPill).toHaveAttribute("aria-expanded", "true");
    expect(part("years"), "the year pill must open a years grid").not.toBeNull();
    expect(part("months"), "the years grid replaces the months grid").toBeNull();
    expect(part("grid"), "and the days grid stays gone").toBeNull();
    expect(
      parts("month"),
      "two explicit grids, not one list: no months among the years",
    ).toHaveLength(0);
    expect(parts("year").map((b) => b.textContent)).toEqual([
      "2024",
      "2025",
      "2026",
      "2027",
      "2028",
    ]);
    expect(
      parts("year")
        .filter((b) => b.hasAttribute("data-current"))
        .map((b) => b.textContent),
      "the visible year is the current one",
    ).toEqual(["2026"]);
  });
});
