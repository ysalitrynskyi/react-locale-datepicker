import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP Track 5 announcements. Each case guards a specific way a screen
 * reader can be left with less than the sighted user has.
 */
describe("announcements: month and year heading", () => {
  it("announces the visible month politely and atomically", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const live = h.dialog().querySelector('[data-part="live-region"]')!;
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(
      live.getAttribute("aria-atomic"),
      "the heading must be atomic — without it a reader announces only the changed fragment, e.g. a bare year",
    ).toBe("true");
    expect(live.textContent).toContain("2026");
  });

  it("re-announces the whole heading after navigation", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 11, 15), // December, so next crosses a year
    });
    await h.openViaClick();
    const live = () =>
      h.dialog().querySelector('[data-part="live-region"]')!.textContent ?? "";
    expect(live()).toContain("2026");
    fireEvent.click(h.headerNext());
    // The fragment that changed is the year; atomic means month goes with it.
    const after = live();
    expect(after).toContain("2027");
    expect(
      after.replace(/[\d\s]/g, "").length,
      "the month name must stay in the announced string, not just the year",
    ).toBeGreaterThan(0);
  });
});

describe("announcements: one-time keyboard help", () => {
  const help = () =>
    document.querySelector('[data-part="keyboard-help"]')?.textContent ?? "";

  it("mounts the help region empty so filling it is a live-region update", async () => {
    // A live region that is inserted already populated is not announced.
    // The region must exist, and be empty, before focus reaches the grid.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const region = h.dialog().querySelector('[data-part="keyboard-help"]');
    expect(region, "the keyboard-help region must exist on open").toBeTruthy();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(
      region!.textContent,
      "the region must mount EMPTY — a pre-populated live region is never announced",
    ).toBe("");
  });

  it("announces the help when focus first enters the grid", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaKeyboard();
    expect(help()).toBe("");
    await h.user.keyboard("{ArrowDown}"); // focus enters the grid
    expect(
      help(),
      "the APG one-time help must be announced when focus enters the grid",
    ).toMatch(/arrow keys/i);
  });

  it("does not re-announce while moving inside the grid", async () => {
    // Repeating it on every arrow key would talk over the day just landed on.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    const first = help();
    await h.user.keyboard("{ArrowRight}{ArrowDown}{ArrowLeft}");
    expect(
      help(),
      "the help text must stay put while navigating — guards a re-announce loop",
    ).toBe(first);
  });

  it("resets for the next open session", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    expect(help()).not.toBe("");
    await h.user.keyboard("{Escape}");
    await h.openViaClick();
    expect(
      help(),
      "each open session starts silent — guards a stale announcement",
    ).toBe("");
  });

  it("is localizable through labels", async () => {
    const h = renderPicker({
      locale: "de",
      initialValue: localDate(2026, 6, 15),
      labels: { keyboardHelp: "Pfeiltasten benutzen." },
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    expect(help()).toBe("Pfeiltasten benutzen.");
  });
});

describe("announcements: calendar trigger accessible name", () => {
  const trigger = () =>
    document.querySelector('[data-part="trigger"]') as HTMLElement;

  it("echoes the committed value into the trigger name", async () => {
    renderPicker({ locale: "en-GB", initialValue: localDate(2026, 10, 17) });
    const label = trigger().getAttribute("aria-label") ?? "";
    expect(
      label,
      "the trigger must restate the committed date — guards an unnamed control",
    ).toContain("Change date");
    expect(label).toContain("17");
    expect(label).toContain("2026");
  });

  it("names the trigger for the empty and open states", async () => {
    const h = renderPicker({ locale: "en", initialValue: null });
    expect(trigger().getAttribute("aria-label")).toBe("Open calendar");
    await h.openViaClick();
    expect(
      trigger().getAttribute("aria-label"),
      "while open, pressing the trigger closes — the name must say so",
    ).toBe("Close calendar");
  });

  it("is no longer hidden from assistive technology", async () => {
    // It was aria-hidden="true", which made the restatement pointless.
    renderPicker({ locale: "en", initialValue: localDate(2026, 6, 15) });
    expect(trigger().getAttribute("aria-hidden")).toBeNull();
    expect(
      trigger().getAttribute("tabindex"),
      "the trigger stays out of the tab order — the input is the tab stop",
    ).toBe("-1");
  });

  it("is localizable through labels", async () => {
    renderPicker({
      locale: "de",
      initialValue: localDate(2026, 10, 17),
      labels: { changeDate: "Datum ändern" },
    });
    expect(trigger().getAttribute("aria-label")).toContain("Datum ändern");
  });
});

describe("announcements: navigation labels stay Intl-derived", () => {
  it("names the nav buttons with the month they navigate to", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    expect(
      h.headerNext().getAttribute("aria-label"),
      "nav labels are derived from Intl, not from a hand-maintained string",
    ).toBe("August 2026");
    expect(h.headerPrev().getAttribute("aria-label")).toBe("June 2026");
  });

  it("follows the locale with no labels entry at all", async () => {
    const h = renderPicker({
      locale: "de",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const expected = new Intl.DateTimeFormat("de", {
      calendar: "gregory",
      month: "long",
      year: "numeric",
    }).format(localDate(2026, 7, 1));
    expect(h.headerNext().getAttribute("aria-label")).toBe(expected);
  });

  it("accepts a labels override when a consumer needs fixed wording", async () => {
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      labels: { previousMonth: "Previous month", nextMonth: "Next month" },
    });
    await h.openViaClick();
    expect(h.headerPrev().getAttribute("aria-label")).toBe("Previous month");
    expect(h.headerNext().getAttribute("aria-label")).toBe("Next month");
  });
});
