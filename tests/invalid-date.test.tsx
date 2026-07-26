import { render, screen } from "@testing-library/react";
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
      render(<LocaleDatePicker value={INVALID} onChange={() => {}} />),
    ).not.toThrow();
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
        aria-label="Date"
      />,
    );
    expect(screen.getByLabelText("Date")).toHaveValue("17.11.2026");
  });
});
