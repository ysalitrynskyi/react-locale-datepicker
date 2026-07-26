import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderPicker, localDate, isoLocal } from "./helpers";

/**
 * Every assertion in this file guards the timezone contract:
 * values are local-midnight Date objects; a selection must never shift a day.
 * CI re-runs the suite under TZ=UTC, America/Los_Angeles and Asia/Tokyo.
 */

function assertLocalMidnight(d: Date, label: string) {
  expect(d.getHours(), `${label}: hours must be 0 (local midnight)`).toBe(0);
  expect(d.getMinutes(), `${label}: minutes must be 0`).toBe(0);
  expect(d.getSeconds(), `${label}: seconds must be 0`).toBe(0);
  expect(d.getMilliseconds(), `${label}: ms must be 0`).toBe(0);
}

describe("values are local-midnight Dates (timezone contract)", () => {
  it("a selected day commits as local midnight", async () => {
    // Parity: values are local-midnight Date objects. No UTC parsing.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 5, 1),
      onChange,
    });
    await h.openViaClick();
    await h.clickDay(15);

    expect(onChange).toHaveBeenCalledTimes(1);
    const committed: Date = onChange.mock.calls[0][0];
    assertLocalMidnight(
      committed,
      "day click commit — guards against UTC/toISOString round-trip day shift",
    );
    expect(isoLocal(committed)).toBe("2026-06-15");
    expect(committed.getDate()).toBe(15);
    expect(committed.getMonth()).toBe(5);
    expect(committed.getFullYear()).toBe(2026);
  });

  it("displayed string and committed value never disagree", async () => {
    // Parity: displayed strings and committed values never disagree.
    const h = renderPicker({
      initialValue: localDate(2026, 2, 10),
    });
    expect(h.input()).toHaveValue("10.03.2026");
    expect(h.committed()).toBe("2026-03-10");

    await h.openViaClick();
    await h.clickDay(28);
    expect(h.input()).toHaveValue("28.03.2026");
    expect(h.committed()).toBe("2026-03-28");
  });

  it("selecting near local late evening still commits the clicked calendar day", async () => {
    // Parity: a date selected at 23:30 local is the date the user clicked,
    // not the next one. We cannot freeze wall-clock easily in every TZ, but
    // constructing via local Date(y,m,d) and reading getDate is the contract.
    const lateLocal = new Date(2026, 6, 4, 23, 30, 0, 0);
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: lateLocal,
      onChange,
    });
    // Opening with a value keeps that month; re-commit a neighbour day.
    await h.openViaClick();
    await h.clickDay(5);
    const committed: Date = onChange.mock.calls[0][0];
    expect(
      committed.getDate(),
      "must commit calendar day 5 even when prior value was 23:30 local",
    ).toBe(5);
    assertLocalMidnight(committed, "post-evening re-commit");
  });
});

describe("month and year boundaries", () => {
  it("handles 28/29/30/31-day months without shifting the day number", async () => {
    for (const [y, m0, last] of [
      [2026, 1, 28], // Feb non-leap
      [2024, 1, 29], // Feb leap
      [2026, 3, 30], // Apr
      [2026, 0, 31], // Jan
    ] as const) {
      const onChange = vi.fn();
      const h = renderPicker({
        initialValue: null,
        defaultCalendarMonth: localDate(y, m0, 1),
        onChange,
      });
      await h.openViaClick();
      await h.clickDay(last);
      const committed: Date = onChange.mock.calls[0][0];
      expect(
        committed.getDate(),
        `last day of ${y}-${m0 + 1} must stay ${last}`,
      ).toBe(last);
      expect(committed.getMonth()).toBe(m0);
      h.unmount();
      onChange.mockReset();
    }
  });

  it("commits a leap-year 29 February selection", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2024, 1, 1),
      onChange,
    });
    await h.openViaClick();
    await h.clickDay(29);
    const committed: Date = onChange.mock.calls[0][0];
    expect(isoLocal(committed)).toBe("2024-02-29");
    expect(committed.getMonth()).toBe(1);
    expect(committed.getDate()).toBe(29);
  });

  it("navigates year boundaries in both directions via header chevrons", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 0, 15),
    });
    await h.openViaClick();
    // Header prev from January 2026 → December 2025.
    fireEvent.click(h.headerPrev());
    expect(h.dialog().textContent).toMatch(/2025|December|Dec/i);

    // Advance twice: Dec 2025 → Jan 2026 → Feb 2026.
    fireEvent.click(h.headerNext());
    fireEvent.click(h.headerNext());
    expect(h.dialog().textContent).toMatch(/2026/);
    expect(h.dialog().textContent).toMatch(/February|Feb/i);
  });
});
