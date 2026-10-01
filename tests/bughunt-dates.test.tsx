// Regression guards for the 2026-09-30 bug hunt: date values at the edges.
// Each test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { localDate, renderPicker } from "./helpers";

const yearOf = (y: number, m0 = 0, d = 1) => {
  const date = new Date(2000, m0, d);
  date.setFullYear(y, m0, d);
  return date;
};

describe("years below 1000 round-trip through the field (BH-004, BH-005)", () => {
  it("pads a three-digit year to four digits on display", () => {
    renderPicker({ initialValue: yearOf(999), locale: "en" });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "01.01.0999",
    );
  });

  it("parses and commits year 0099 without mapping it to 1999", () => {
    const onChange = vi.fn();
    const h = renderPicker({ locale: "en", onChange });
    fireEvent.change(h.input(), { target: { value: "01.01.0099" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    const d = onChange.mock.calls[0][0] as Date;
    expect(d.getFullYear(), "year 99 must not become 1999").toBe(99);
    expect((h.input() as HTMLInputElement).value).toBe("01.01.0099");
  });

  it("year 100 still commits as year 100", () => {
    const onChange = vi.fn();
    const h = renderPicker({ locale: "en", onChange });
    fireEvent.change(h.input(), { target: { value: "01.01.0100" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    expect((onChange.mock.calls[0][0] as Date).getFullYear()).toBe(100);
  });
});

describe("a Date from another realm is a date (BH-006)", () => {
  it("renders a foreign-realm value instead of an empty field", () => {
    const ForeignDate = vm.runInNewContext("Date") as DateConstructor;
    const d = new ForeignDate(2026, 5, 15);
    expect(d instanceof Date).toBe(false);
    renderPicker({ initialValue: d, locale: "en" });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "15.06.2026",
    );
  });

  it("treats a foreign-realm minDate as a real bound", async () => {
    const ForeignDate = vm.runInNewContext("Date") as DateConstructor;
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      minDate: new ForeignDate(2026, 5, 1),
      locale: "en",
    });
    await h.openViaClick();
    expect(h.headerPrev()).toBeDisabled();
  });

  it("rejects a prototype-only fake Date instead of throwing", () => {
    const fake = Object.create(Date.prototype) as Date;
    expect(() =>
      render(
        <LocaleDatePicker value={fake} onChange={() => {}} placeholder="p" />,
      ),
    ).not.toThrow();
  });
});

describe("finite Dates at the time-value edges never throw (BH-085)", () => {
  it.each([
    ["minimum", -8.64e15],
    ["maximum", 8.64e15],
  ])("the %s instant renders as an empty field", (_, t) => {
    expect(() =>
      render(
        <LocaleDatePicker
          value={new Date(t)}
          onChange={() => {}}
          placeholder="p"
          aria-label="Date"
        />,
      ),
    ).not.toThrow();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("");
  });
});

describe("the year list always contains the open year (BH-068)", () => {
  const openYears = async (props: Parameters<typeof renderPicker>[0]) => {
    const h = renderPicker(props);
    await h.openViaClick();
    fireEvent.click(h.dialog().querySelector('[data-part="year-pill"]')!);
    return h;
  };

  it("includes a committed year past today + 2 and marks it current", async () => {
    const h = await openYears({
      today: localDate(2026, 5, 15),
      initialValue: localDate(2029, 5, 15),
      locale: "en",
    });
    const current = h.dialog().querySelector('[data-part="year"][data-current]');
    expect(current?.textContent).toBe("2029");
  });

  it("includes a defaultCalendarMonth year outside the window", async () => {
    const h = await openYears({
      today: localDate(2026, 5, 15),
      defaultCalendarMonth: localDate(2030, 0, 1),
      locale: "en",
    });
    const current = h.dialog().querySelector('[data-part="year"][data-current]');
    expect(current?.textContent).toBe("2030");
  });

  it("caps an absurd bound span instead of rendering thousands of buttons", async () => {
    const h = await openYears({
      initialValue: localDate(2026, 5, 15),
      minDate: yearOf(-200000),
      maxDate: localDate(2030, 0, 1),
      locale: "en",
    });
    const years = within(h.dialog()).getAllByRole("button").filter((b) =>
      b.matches('[data-part="year"]'),
    );
    expect(years.length).toBeLessThanOrEqual(600);
    expect(
      h.dialog().querySelector('[data-part="year"][data-current]')?.textContent,
    ).toBe("2026");
  });
});
