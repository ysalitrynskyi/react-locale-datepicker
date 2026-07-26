import { describe, expect, it, vi } from "vitest";
import { renderPicker, localDate, isoLocal } from "./helpers";

/**
 * ROADMAP Track 2: "the optional-settings principle has to run backwards
 * too". Each built-in gets an opt-out whose DEFAULT is today's behaviour,
 * so no existing caller changes. The default assertions below matter more
 * than the opt-out ones — they are what stops a default drifting.
 */
describe("opt-out: showEcho", () => {
  it("renders the echo by default", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    expect(
      h.container.querySelector('[data-part="echo"]'),
      "the echo is 0.1.0 default behaviour — guards a silent default change",
    ).toBeTruthy();
  });

  it("hides the echo when opted out, without touching the value", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      showEcho: false,
      onChange,
    });
    expect(h.container.querySelector('[data-part="echo"]')).toBeNull();
    // The picker still commits normally; only the restatement is gone.
    await h.openViaClick();
    await h.clickDay(20);
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-20");
    expect(h.container.querySelector('[data-part="echo"]')).toBeNull();
  });
});

describe("opt-out: showWeekdayHeader", () => {
  it("renders the weekday header by default", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    expect(
      h.dialog().querySelectorAll('[role="columnheader"]').length,
      "weekday headers are 0.1.0 default behaviour",
    ).toBe(7);
  });

  it("hides the header while keeping the grid semantics intact", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      showWeekdayHeader: false,
    });
    await h.openViaClick();
    expect(h.dialog().querySelectorAll('[role="columnheader"]')).toHaveLength(
      0,
    );
    // The grid must still be a grid: rows, cells and the roving tab stop.
    const grid = h.dialog().querySelector('[role="grid"]')!;
    expect(
      grid.querySelectorAll('[role="row"]').length,
      "dropping the header must not cost the grid its rows",
    ).toBeGreaterThanOrEqual(4);
    expect(
      h.dayButtons().filter((b) => b.getAttribute("tabindex") === "0"),
    ).toHaveLength(1);
  });
});

describe("opt-out: showTodayMarker", () => {
  it("marks today by default, visually and for screen readers", async () => {
    const today = new Date();
    const h = renderPicker({ locale: "en-US", initialValue: null });
    await h.openViaClick();
    const cell = h.dayButton(today.getDate());
    expect(
      cell,
      "today is marked by default — guards a silent default change",
    ).toHaveAttribute("data-today");
    expect(cell).toHaveAttribute("aria-current", "date");
  });

  it("removes the marker from both modalities when opted out", async () => {
    // A marker hidden from sighted users but still announced (or the
    // reverse) is a worse contract than no marker, so the opt-out covers
    // both or neither.
    const today = new Date();
    const h = renderPicker({
      locale: "en-US",
      initialValue: null,
      showTodayMarker: false,
    });
    await h.openViaClick();
    const cell = h.dayButton(today.getDate());
    expect(cell).not.toHaveAttribute("data-today");
    expect(
      cell.getAttribute("aria-current"),
      "opting out of the today marker must also drop aria-current",
    ).toBeNull();
  });

  it("leaves selection and disabling untouched", async () => {
    const today = new Date();
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en-US",
      initialValue: today,
      showTodayMarker: false,
      onChange,
    });
    await h.openViaClick();
    const cell = h.dayButton(today.getDate());
    expect(cell).toHaveAttribute("data-selected");
    expect(
      cell.closest('[role="gridcell"]')?.getAttribute("aria-selected"),
    ).toBe("true");
  });
});
