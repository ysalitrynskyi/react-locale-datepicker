import { describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";
import { renderPicker, localDate, isoLocal } from "./helpers";

/**
 * ROADMAP Track 5: the day grid exposes role="grid" semantics with
 * aria-selected (the APG/Duet model), replacing the aria-current="date"
 * marking of the selection. An accessibility correction, so it ships as a
 * default rather than an opt-in.
 *
 * Every test below that touches the keyboard exists because the migration
 * had to preserve the roving-tabindex and focus rules exactly — those are
 * parity-contract behaviour and are the easiest thing to break when the DOM
 * grows two levels of wrappers.
 */
describe("day grid exposes role=grid semantics", () => {
  it("nests grid > row/rowgroup > row > gridcell", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();

    const grid = h.dialog().querySelector('[role="grid"]');
    expect(
      grid,
      'day grid must expose role="grid" — guards the APG grid migration',
    ).toBeTruthy();

    // Column headers: one per weekday, in column order.
    const headers = grid!.querySelectorAll('[role="columnheader"]');
    expect(
      headers.length,
      "grid must publish seven column headers — guards ragged table reporting",
    ).toBe(7);

    // Rows live under a rowgroup; every row holds exactly seven cells so
    // grid navigation never reports a ragged table.
    const rowgroup = grid!.querySelector('[role="rowgroup"]');
    expect(rowgroup, "day rows must be owned by a rowgroup").toBeTruthy();
    const rows = rowgroup!.querySelectorAll('[role="row"]');
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of Array.from(rows)) {
      expect(
        row.querySelectorAll('[role="gridcell"]').length,
        "every week row must hold seven gridcells, padding included",
      ).toBe(7);
    }
  });

  it("names the grid with the visible month and year", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const grid = h.dialog().querySelector('[role="grid"]')!;
    expect(
      grid.getAttribute("aria-label"),
      "grid must be named with the month it shows — guards an unnamed grid",
    ).toContain("2026");
  });

  it("marks the selected day with aria-selected on its gridcell", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const selectedCell = h.dayButton(15).closest('[role="gridcell"]');
    expect(
      selectedCell?.getAttribute("aria-selected"),
      'selected day must carry aria-selected="true" — guards the aria-current regression',
    ).toBe("true");
    const otherCell = h.dayButton(16).closest('[role="gridcell"]');
    expect(
      otherCell?.getAttribute("aria-selected"),
      "unselected days must report aria-selected=false so the grid reads as selectable",
    ).toBe("false");
  });

  it('reserves aria-current="date" for today, not for the selection', async () => {
    // The correction: aria-current="date" means "this is the current date",
    // so it belongs on today. Selection is carried by aria-selected.
    const today = new Date();
    const selected = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() === 1 ? 2 : 1,
    );
    const h = renderPicker({ locale: "en", initialValue: selected });
    await h.openViaClick();

    const selectedButton = h.dayButton(selected.getDate());
    expect(
      selectedButton.getAttribute("aria-current"),
      'selected day must not claim aria-current="date" — that marks today',
    ).toBeNull();

    const todayButton = h.dayButton(today.getDate());
    expect(
      todayButton.getAttribute("aria-current"),
      'today must carry aria-current="date"',
    ).toBe("date");
  });

  it("announces column headers with the long weekday name", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const headers = Array.from(
      h.dialog().querySelectorAll('[role="columnheader"]'),
    );
    for (const header of headers) {
      expect(
        header.getAttribute("aria-label"),
        "column headers must be announced with the full weekday, not the abbreviation",
      ).toMatch(/day$/i);
    }
  });
});

describe("grid migration preserves keyboard and focus behaviour", () => {
  it("keeps exactly one roving tab stop in the grid", async () => {
    // Parity: the roving-tabindex chain is deliberate. Two tab stops (or
    // none) is the failure mode the extra wrapper elements could introduce.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const tabbable = h
      .dayButtons()
      .filter((b) => b.getAttribute("tabindex") === "0");
    expect(
      tabbable.length,
      "grid must expose exactly one tab stop — guards roving-tabindex loss",
    ).toBe(1);
    expect(tabbable[0].textContent?.trim()).toBe("15");
  });

  it("arrow keys still move day by day and commit with Enter", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      onChange,
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}"); // into the grid, on 15
    await h.user.keyboard("{ArrowRight}{Enter}");
    expect(
      isoLocal(onChange.mock.calls[0][0]),
      "arrow navigation and Enter must survive the grid migration",
    ).toBe("2026-07-16");
    expect(h.queryDialog()).toBeNull();
  });

  it("ArrowDown crosses a week row boundary", async () => {
    // The one movement that now spans two DOM rows rather than staying in a
    // single flat container.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}"); // into the grid, on 15
    await h.user.keyboard("{ArrowDown}"); // one week later
    const next = h.dialog().querySelector('[data-day="2026-6-22"]');
    expect(
      next,
      "ArrowDown must move a full week across row boundaries",
    ).toBeTruthy();
    expect(next).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(next);
  });

  it("day cells remain buttons so Enter and Space still activate them", async () => {
    // aria-selected forced the state onto the gridcell wrapper; the day
    // itself must stay a button or every keyboard commit path breaks.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const days = within(h.dialog())
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("data-day"));
    expect(
      days.length,
      "day cells must keep the button role — guards keyboard activation",
    ).toBeGreaterThan(20);
    expect(days[0].tagName).toBe("BUTTON");
  });

  it("keeps disabled days focusable so traversal never dead-ends", async () => {
    // Parity: aria-disabled, not the disabled attribute — a natively
    // disabled cell cannot receive focus and silently breaks roving.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      shouldDisableDate: (d) => d.getDate() === 16,
    });
    await h.openViaClick();
    const day16 = h.dayButton(16);
    expect(day16).toHaveAttribute("aria-disabled", "true");
    expect(
      day16.hasAttribute("disabled"),
      "disabled days must not use the native disabled attribute",
    ).toBe(false);
  });
});
