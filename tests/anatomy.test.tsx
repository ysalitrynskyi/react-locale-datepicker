import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { ANATOMY } from "../src/LocaleDatePicker";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP 0.2 / decision D10: the anatomy is published, which means the
 * canonical list, the rendered DOM and the override keys are one thing.
 * These tests are what keeps them one thing — a part added to ANATOMY but
 * never stamped, or an element rendered without its part, fails here.
 */

/** Every data-part value present in a container, including the container. */
function partsIn(el: Element): string[] {
  const found = Array.from(el.querySelectorAll("[data-part]")).map(
    (node) => node.getAttribute("data-part")!,
  );
  const own = el.getAttribute("data-part");
  return own ? [own, ...found] : found;
}

describe("published anatomy", () => {
  it("stamps a data-part on every element the component renders", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      minDate: localDate(2024, 0, 1),
      maxDate: localDate(2028, 11, 31),
    });

    const seen = new Set<string>();
    const root = () => h.container.querySelector('[data-part="root"]')!;

    // Closed: root, field, input, trigger, its icon, and the echo.
    partsIn(root()).forEach((p) => seen.add(p));

    // Open on the days view. July 2026 starts on a Wednesday, so with the
    // en-US Sunday week start the grid also renders padding cells.
    await h.openViaClick();
    partsIn(root()).forEach((p) => seen.add(p));

    // Months and years views render their own grids.
    const pills = () =>
      Array.from(h.dialog().querySelectorAll("button[aria-expanded]"));
    fireEvent.click(pills()[0]);
    partsIn(root()).forEach((p) => seen.add(p));
    fireEvent.click(pills()[1]);
    partsIn(root()).forEach((p) => seen.add(p));

    const declared = ANATOMY.map((entry) => entry.part).sort();
    const missing = declared.filter((part) => !seen.has(part));
    expect(
      missing,
      "every part in ANATOMY must be stamped on a real element — an entry with no element is a broken published contract",
    ).toEqual([]);

    const undeclared = [...seen]
      .filter((part) => !declared.includes(part as (typeof declared)[number]))
      .sort();
    expect(
      undeclared,
      "every stamped part must be declared in ANATOMY — an element with an undocumented part is an unpublished contract",
    ).toEqual([]);
  });

  it("keeps the 0.1.0 classNames slots working unchanged", async () => {
    // The Slot type grew in 0.2.0; it must never have shrunk. Each key below
    // shipped in 0.1.0 and a consumer may already depend on it.
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      shouldDisableDate: (d) => d.getDate() === 16,
      classNames: {
        input: "x-input",
        echo: "x-echo",
        popover: "x-popover",
        header: "x-header",
        grid: "x-grid",
        day: "x-day",
        daySelected: "x-day-selected",
        dayDisabled: "x-day-disabled",
      },
    });
    expect(h.input()).toHaveClass("rldp-input", "x-input");
    expect(h.container.querySelector('[data-part="echo"]')).toHaveClass(
      "x-echo",
    );
    await h.openViaClick();
    expect(h.dialog()).toHaveClass("rldp-popover", "x-popover");
    expect(h.dialog().querySelector('[data-part="header"]')).toHaveClass(
      "x-header",
    );
    expect(h.dialog().querySelector('[data-part="grid"]')).toHaveClass(
      "x-grid",
    );
    expect(h.dayButton(15)).toHaveClass("rldp-day", "x-day", "x-day-selected");
    expect(h.dayButton(16)).toHaveClass("x-day-disabled");
    expect(
      h.dayButton(17).className,
      "unselected, enabled days must not pick up state classes",
    ).not.toContain("x-day-selected");
  });

  it("applies the classNames slots added in 0.2.0", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      classNames: {
        root: "x-root",
        field: "x-field",
        trigger: "x-trigger",
        triggerIcon: "x-trigger-icon",
        navPrevious: "x-prev",
        navNext: "x-next",
        monthPill: "x-month-pill",
        yearPill: "x-year-pill",
        weekday: "x-weekday",
        week: "x-week",
        dayCell: "x-day-cell",
      },
    });
    expect(h.container.querySelector('[data-part="root"]')).toHaveClass(
      "rldp-root",
      "x-root",
    );
    expect(h.container.querySelector('[data-part="field"]')).toHaveClass(
      "x-field",
    );
    expect(h.container.querySelector('[data-part="trigger"]')).toHaveClass(
      "x-trigger",
    );
    expect(h.container.querySelector('[data-part="trigger-icon"]')).toHaveClass(
      "x-trigger-icon",
    );
    await h.openViaClick();
    const q = (part: string) =>
      h.dialog().querySelector(`[data-part="${part}"]`);
    expect(q("nav-previous")).toHaveClass("rldp-nav", "x-prev");
    expect(q("nav-next")).toHaveClass("rldp-nav", "x-next");
    expect(q("month-pill")).toHaveClass("x-month-pill");
    expect(q("year-pill")).toHaveClass("x-year-pill");
    expect(q("weekday")).toHaveClass("x-weekday");
    expect(q("week")).toHaveClass("x-week");
    expect(q("day-cell")).toHaveClass("x-day-cell");
  });

  it("adds dayToday only to today and only while it is unselected", async () => {
    const today = new Date();
    const h = renderPicker({
      locale: "en-US",
      initialValue: null,
      classNames: { dayToday: "x-today" },
    });
    await h.openViaClick();
    expect(
      h.dayButton(today.getDate()),
      "the today marker class must follow the data-today attribute",
    ).toHaveClass("x-today");
    h.unmount(); // the helper's queries are document-wide

    const selected = renderPicker({
      locale: "en-US",
      initialValue: today,
      classNames: { dayToday: "x-today" },
    });
    await selected.openViaClick();
    expect(
      selected.dayButton(today.getDate()).className,
      "a selected today is styled as selected, not as today — matches data-today",
    ).not.toContain("x-today");
  });

  it("exposes the state attributes an unstyled consumer needs", async () => {
    // The headless escape hatch is "do not import the stylesheet". It only
    // works if state is legible from the DOM alone.
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      hasError: true,
      shouldDisableDate: (d) => d.getDate() === 16,
    });
    expect(
      h.container.querySelector('[data-part="field"]'),
    ).toHaveAttribute("data-error");
    await h.openViaClick();
    expect(h.dayButton(15)).toHaveAttribute("data-selected");
    expect(h.dayButton(16)).toHaveAttribute("data-disabled");
    expect(h.dialog()).toHaveAttribute("data-placement");
  });
});
