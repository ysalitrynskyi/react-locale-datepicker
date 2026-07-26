import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleDatePicker } from "../src/LocaleDatePicker";

/**
 * Guards the crash described in docs/EXTRACTION.md's spirit: this component
 * exists to format dates, so it must never be the thing that takes an
 * application down over a bad one.
 *
 * `new Date("nope")` is a Date whose time value is NaN. Every
 * Intl.DateTimeFormat.format() call on one throws `RangeError: Invalid time
 * value`, and thrown from render that unmounts the consumer's whole tree.
 * Reproduced against 0.3.1 before the fix.
 */
describe("an unusable Date never crashes the host tree", () => {
  const INVALID = new Date("nope");

  it("renders with an Invalid Date as value", () => {
    expect(() =>
      render(
        <LocaleDatePicker
          value={INVALID}
          onChange={() => {}}
          placeholder="dd.mm.yyyy"
        />,
      ),
    ).not.toThrow();
  });

  it("renders and opens with an Invalid defaultCalendarMonth", () => {
    // Reached the viewMonth state and crashed at MOUNT via the header
    // labels, which format on every render whether the popup is open or
    // not — a hole the original value-only guard left open.
    expect(() =>
      render(
        <LocaleDatePicker
          value={null}
          onChange={() => {}}
          placeholder="dd.mm.yyyy"
          aria-label="Date"
          defaultCalendarMonth={new Date("nope")}
        />,
      ),
    ).not.toThrow();
    fireEvent.click(screen.getByLabelText("Date"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("Invalid minDate/maxDate degrade to unbounded, not to an empty year grid", () => {
    render(
      <LocaleDatePicker
        value={new Date(2026, 6, 18)}
        onChange={() => {}}
        placeholder="dd.mm.yyyy"
        aria-label="Date"
        minDate={new Date("nope")}
        maxDate={new Date("nope")}
      />,
    );
    fireEvent.click(screen.getByLabelText("Date"));
    // With the guard, invalid bounds behave exactly like absent bounds:
    // the default 120-year grid, not a zero-row one.
    fireEvent.click(screen.getByRole("button", { name: "2026", exact: true }));
    expect(
      screen.getByRole("button", { name: "1967", exact: true }),
    ).toBeTruthy();
  });

  it("treats an Invalid Date as no date, leaving the field empty", () => {
    render(
      <LocaleDatePicker
        value={INVALID}
        onChange={() => {}}
        aria-label="Date"
        placeholder="dd.mm.yyyy"
      />,
    );
    // Degrades to the same state as value={null} rather than showing "NaN".
    expect(screen.getByLabelText("Date")).toHaveValue("");
  });

  it("renders with an Invalid Date as the injected today", () => {
    // An Invalid Date is truthy, so a plain `if (todayProp)` would have let it
    // through into startOfDay() and on into every formatter.
    expect(() =>
      render(
        <LocaleDatePicker
          value={null}
          onChange={() => {}}
          placeholder="dd.mm.yyyy"
          today={INVALID}
        />,
      ),
    ).not.toThrow();
  });

  it("still opens the calendar when value is unusable", async () => {
    const onChange = vi.fn();
    render(
      <LocaleDatePicker
        value={INVALID}
        onChange={onChange}
        placeholder="dd.mm.yyyy"
        aria-label="Date"
      />,
    );
    const input = screen.getByLabelText("Date");
    expect(() => input.click()).not.toThrow();
  });

  it("a valid Date is unaffected", () => {
    render(
      <LocaleDatePicker
        value={new Date(2026, 10, 17)}
        onChange={() => {}}
        placeholder="dd.mm.yyyy"
        aria-label="Date"
      />,
    );
    expect(screen.getByLabelText("Date")).toHaveValue("17.11.2026");
  });
});
