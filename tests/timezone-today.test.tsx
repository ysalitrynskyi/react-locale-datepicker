// Decision D16: what counts as "today" is injectable, because a shop's
// availability rules can run on the seller's calendar day while the visitor
// sits up to a whole day away. Values stay local-midnight Dates throughout —
// these tests guard the marker derivation, never a value conversion.
import { describe, expect, it } from "vitest";
import { within } from "@testing-library/react";
import { todayInTimeZone } from "../src/LocaleDatePicker";
import { localDate, renderPicker } from "./helpers";

describe("todayInTimeZone", () => {
  it("returns a local-midnight Date (the value contract shape)", () => {
    const d = todayInTimeZone("UTC");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it("far-apart zones differ by at most the calendar-day spread", () => {
    // Etc/GMT+12 is UTC-12 and Etc/GMT-14 is UTC+14 (POSIX sign flip):
    // 26 hours apart, so their calendar days differ by one or two, never
    // more, and never negatively.
    const west = todayInTimeZone("Etc/GMT+12");
    const east = todayInTimeZone("Etc/GMT-14");
    const days = (east.getTime() - west.getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(1);
    expect(days).toBeLessThanOrEqual(2);
  });

  it("an invalid zone falls back to the visitor's local today, never throws", () => {
    const local = new Date();
    const d = todayInTimeZone("Not/AZone");
    expect(d.getFullYear()).toBe(local.getFullYear());
    expect(d.getHours()).toBe(0);
  });
});

describe("today and timeZone props", () => {
  it("an injected today drives the ring and aria-current deterministically", async () => {
    const h = renderPicker({
      today: localDate(2026, 5, 10),
      defaultCalendarMonth: localDate(2026, 5, 1),
      locale: "en",
    });
    await h.openViaClick();
    const cell = h.dayButton(10);
    expect(cell.getAttribute("aria-current")).toBe("date");
    expect(cell.hasAttribute("data-today")).toBe(true);
    // No other cell claims today.
    const marked = h.dayButtons().filter((b) => b.hasAttribute("data-today"));
    expect(marked).toHaveLength(1);
  });

  it("an injected today anchors the empty-open view month", async () => {
    const h = renderPicker({ today: localDate(2027, 2, 15), locale: "en" });
    await h.openViaClick();
    expect(
      within(h.dialog()).getByRole("grid", { name: /March 2027/ }),
    ).toBeTruthy();
  });

  it("timeZone derives the marker from that zone's calendar day", async () => {
    const zone = "Etc/GMT-14";
    const expected = todayInTimeZone(zone);
    const h = renderPicker({
      timeZone: zone,
      defaultCalendarMonth: expected,
      locale: "en",
    });
    await h.openViaClick();
    const cell = h.dayButton(expected.getDate());
    expect(cell.getAttribute("aria-current")).toBe("date");
  });

  it('"default" and "system" mean the visitor\'s own zone', async () => {
    for (const zone of ["default", "system"] as const) {
      const local = todayInTimeZone("Not/AZone"); // = local today
      const h = renderPicker({
        timeZone: zone,
        defaultCalendarMonth: local,
        locale: "en",
      });
      await h.openViaClick();
      expect(h.dayButton(local.getDate()).getAttribute("aria-current")).toBe(
        "date",
      );
      h.unmount();
    }
  });

  it("today wins over timeZone when both are supplied", async () => {
    const h = renderPicker({
      today: localDate(2026, 5, 10),
      timeZone: "Etc/GMT-14",
      defaultCalendarMonth: localDate(2026, 5, 1),
      locale: "en",
    });
    await h.openViaClick();
    expect(h.dayButton(10).getAttribute("aria-current")).toBe("date");
  });
});
