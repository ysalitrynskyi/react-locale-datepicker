import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { expect as vitestExpect } from "vitest";
import { renderPicker, localDate, isoLocal } from "./helpers";

vitestExpect.extend(matchers);

describe("accessibility: aria passthrough", () => {
  it("aria-label, aria-invalid, aria-describedby reach the input with exact spelling", () => {
    // Parity: aria-* pass through to the input with the exact spelling
    // regression tests assert.
    const h = renderPicker({
      initialValue: null,
      "aria-label": "Departure date",
      "aria-invalid": true,
      "aria-describedby": "date-hint",
    });
    const input = h.input();
    expect(input).toHaveAttribute("aria-label", "Departure date");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "date-hint");
  });
});

describe("accessibility: keyboard path", () => {
  it("full keyboard path: open, navigate, commit, dismiss", async () => {
    // Parity: keyboard navigation works — open, move, commit, dismiss.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 6, 15),
      onChange,
    });
    // Open via ArrowDown.
    h.input().focus();
    await h.user.keyboard("{ArrowDown}");
    expect(h.queryDialog()).toBeTruthy();
    // Enter the grid.
    await h.user.keyboard("{ArrowDown}");
    // Move one day right and commit.
    await h.user.keyboard("{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    // The day AFTER the starting 15 July. Entering the grid already put the
    // cursor on 15 July and Enter commits the cursor, so a dead ArrowRight
    // would still fire onChange and close the dialog — for the wrong day.
    expect(
      isoLocal(onChange.mock.calls[0][0]),
      "ArrowRight must move the cursor one day before Enter commits it",
    ).toBe("2026-07-16");
    expect(h.queryDialog()).toBeNull();

    // Re-open and dismiss with Escape; focus returns to the input.
    h.input().focus();
    await h.user.keyboard("{ArrowDown}");
    expect(h.queryDialog()).toBeTruthy();
    await h.user.keyboard("{Escape}");
    expect(h.queryDialog()).toBeNull();
    expect(
      document.activeElement,
      "focus must return to the input on close — guards focus loss",
    ).toBe(h.input());
  });

  it("focus returns to the input after day-click commit", async () => {
    // Parity: focus returns to the input on close.
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 6, 1),
    });
    await h.openViaClick();
    await h.clickDay(10);
    expect(h.queryDialog()).toBeNull();
    expect(document.activeElement).toBe(h.input());
  });
});

describe("accessibility: axe on open popover", () => {
  it("open popover has no serious axe violations", async () => {
    // TESTING: automated axe pass on the open popover (scoped to the dialog;
    // the text input's aria-expanded is a known Track-5 item, not the popover).
    const h = renderPicker({
      initialValue: localDate(2026, 6, 15),
      "aria-label": "Pick a date",
    });
    await h.openViaClick();
    const results = await axe(h.dialog(), {
      rules: {
        // jsdom performs no layout or colour resolution, so axe cannot
        // compute contrast here even now that Phase 2 ships a stylesheet.
        // Contrast is a browser concern — the tokens in src/styles.css pair
        // foreground/background per surface; verify visually or in e2e.
        "color-contrast": { enabled: false },
      },
    });
    expect(
      results,
      "open popover must pass axe — guards a11y regressions at publish",
    ).toHaveNoViolations();
  });
});

describe("accessibility: RTL layout hooks", () => {
  it("renders under dir=rtl without throwing and keeps nav chevrons", async () => {
    // Parity: RTL locales lay out correctly, including navigation arrows.
    // Structural check here; visual arrow flip is covered in Playwright.
    const h = renderPicker({
      locale: "ar",
      initialValue: localDate(2026, 4, 10),
    });
    // Wrap is done by consumer via dir; simulate nearest ancestor.
    h.container.setAttribute("dir", "rtl");
    await h.openViaClick();
    expect(h.queryDialog()).toBeTruthy();
    // The scenario is only RTL if the dialog really sits under an RTL
    // ancestor: the nearest [dir] is what the component reads and what the
    // stylesheet's [dir="rtl"] rule matches.
    expect(h.container).toHaveAttribute("dir", "rtl");
    expect(
      h.dialog().closest("[dir]"),
      "the dialog must sit under the RTL container",
    ).toBe(h.container);
    // The navigation chevrons are the nav-icon parts, one inside each of the
    // previous and next buttons. Counting svgs would not do: the month and
    // year pills each carry a caret svg, and those two alone satisfy any
    // "at least two".
    const navIcons = h.dialog().querySelectorAll('[data-part="nav-icon"]');
    expect(
      navIcons.length,
      "exactly two navigation chevrons: previous and next",
    ).toBe(2);
    for (const nav of ["nav-previous", "nav-next"]) {
      expect(
        h
          .dialog()
          .querySelector(`[data-part="${nav}"] [data-part="nav-icon"]`),
        `${nav} must contain its chevron`,
      ).toBeTruthy();
    }
  });
});
