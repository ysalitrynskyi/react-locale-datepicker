// Regression guard prompted by a field report against a consumer product:
// a user could not enter a 1967 birth date, floored at 1969-12-31 — the
// Unix epoch as seen west of UTC, the signature of timestamp-zero logic.
// This package has no such logic; these tests pin that no floor ever
// appears: dates decades before 1970 type, parse, commit, navigate and
// render like any other date.
import { describe, expect, it } from "vitest";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { localDate, renderPicker } from "./helpers";

describe("dates before the Unix epoch", () => {
  it("a typed 1967 birth date commits (no epoch floor)", async () => {
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "02031967" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    await waitFor(() => {
      expect(h.committed()).toBe("1967-03-02");
    });
  });

  it("typing with separators reaches 1967 too", async () => {
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "2.3.1967" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    await waitFor(() => {
      expect(h.committed()).toBe("1967-03-02");
    });
  });

  it("the grid renders and commits a pre-epoch month by click", async () => {
    const h = renderPicker({
      initialValue: localDate(1967, 2, 2),
      locale: "en",
    });
    await h.openViaClick();
    expect(
      within(h.dialog()).getByRole("grid", { name: /March 1967/ }),
    ).toBeTruthy();
    await h.clickDay(15);
    await waitFor(() => {
      expect(h.committed()).toBe("1967-03-15");
    });
  });

  it("keyboard navigation crosses 1970 backwards without snagging", async () => {
    const h = renderPicker({
      initialValue: localDate(1970, 0, 15),
      locale: "en",
    });
    await h.openViaKeyboard();
    // Shift+PageUp steps a whole year back: Jan 1970 -> Jan 1969.
    fireEvent.keyDown(h.dialog().querySelector('[role="grid"]')!, {
      key: "PageUp",
      shiftKey: true,
    });
    await waitFor(() => {
      expect(
        within(h.dialog()).getByRole("grid", { name: /January 1969/ }),
      ).toBeTruthy();
    });
  });

  it("with minDate set, the year grid reaches it (1900)", async () => {
    const h = renderPicker({
      initialValue: localDate(1967, 2, 2),
      minDate: localDate(1900, 0, 1),
      maxDate: localDate(2026, 11, 31),
      locale: "en",
    });
    await h.openViaClick();
    const yearPill = within(h.dialog()).getByRole("button", {
      name: "1967",
      exact: true,
    });
    fireEvent.click(yearPill);
    expect(
      within(h.dialog()).getByRole("button", { name: "1900", exact: true }),
    ).toBeTruthy();
  });

  it("without minDate, the year grid spans 120 years back by default", async () => {
    const h = renderPicker({ today: localDate(2026, 6, 26), locale: "en" });
    await h.openViaClick();
    const yearPill = within(h.dialog()).getByRole("button", {
      name: "2026",
      exact: true,
    });
    fireEvent.click(yearPill);
    expect(
      within(h.dialog()).getByRole("button", { name: "1967", exact: true }),
    ).toBeTruthy();
    expect(
      within(h.dialog()).getByRole("button", { name: "1906", exact: true }),
    ).toBeTruthy();
  });
});
