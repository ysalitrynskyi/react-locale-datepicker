import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { expect as vitestExpect } from "vitest";
import { renderPicker, localDate } from "./helpers";

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
    expect(onChange).toHaveBeenCalled();
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
        // Colour contrast needs a real stylesheet; the port still uses utility
        // class names pending D3. Disable until Phase 2 ships CSS.
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
    const chevrons = h.dialog().querySelectorAll("svg");
    expect(chevrons.length).toBeGreaterThanOrEqual(2);
  });
});
