import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP 0.2 / Track 2: `styles` completes what `classNames` started —
 * the same anatomy keys, addressed with inline styles for the values a
 * consumer cannot express as a token or a class.
 *
 * Elements are found through their data-part and then compared with the
 * element a user works with (the textbox, the dialog, a day button). A style
 * map is keyed by part, so the style has to land on the element that carries
 * that part; finding the element by role and checking its style would stay
 * green with the part moved onto a wrapper.
 */
const byPart = (scope: ParentNode, part: string, state = "") =>
  scope.querySelector(`[data-part="${part}"]${state}`);

describe("styles map", () => {
  it("applies inline styles per slot", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      styles: {
        root: { maxWidth: "300px" },
        input: { fontStyle: "italic" },
        echo: { color: "rgb(1, 2, 3)" },
        popover: { borderRadius: "16px" },
        day: { letterSpacing: "2px" },
      },
    });
    expect(byPart(h.container, "root")).toHaveStyle({
      maxWidth: "300px",
    });
    const input = byPart(h.container, "input");
    expect(input, "the input part must be the textbox itself").toBe(h.input());
    expect(input).toHaveStyle({ fontStyle: "italic" });
    expect(byPart(h.container, "echo")).toHaveStyle({
      color: "rgb(1, 2, 3)",
    });
    await h.openViaClick();
    const popover = byPart(document, "popover");
    expect(popover, "the popover part must be the dialog itself").toBe(
      h.dialog(),
    );
    expect(popover).toHaveStyle({ borderRadius: "16px" });
    const day = byPart(h.dialog(), "day", "[data-selected]");
    expect(day, "the selected day must be a day part").toBe(h.dayButton(15));
    expect(day).toHaveStyle({ letterSpacing: "2px" });
  });

  it("layers state slots on top of the part's own entry", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      shouldDisableDate: (d) => d.getDate() === 16,
      styles: {
        day: { letterSpacing: "2px", fontWeight: "400" },
        daySelected: { fontWeight: "700" },
        dayDisabled: { opacity: "0.2" },
      },
    });
    await h.openViaClick();
    // Selected day: base entry applies, the state entry wins the overlap.
    const selected = byPart(h.dialog(), "day", "[data-selected]");
    expect(selected, "the selected day must be a day part").toBe(
      h.dayButton(15),
    );
    expect(selected).toHaveStyle({
      letterSpacing: "2px",
      fontWeight: "700",
    });
    // Unselected, enabled day keeps only the base entry.
    const plain = byPart(h.dialog(), "day", '[data-day="2026-6-17"]');
    expect(plain, "every day button is a day part").toBe(h.dayButton(17));
    expect(plain).toHaveStyle({
      letterSpacing: "2px",
      fontWeight: "400",
    });
    const disabled = byPart(h.dialog(), "day", "[data-disabled]");
    expect(disabled, "the disabled day must be a day part").toBe(
      h.dayButton(16),
    );
    expect(disabled).toHaveStyle({ opacity: "0.2" });
  });

  it("keeps the measured popover offset when a consumer styles the popover", async () => {
    // Regression guard: the flip-and-shift measurement writes `left` on the
    // popover. A consumer style map must layer on top of that, not replace
    // the object and strand the popup off screen.
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      styles: { popover: { borderRadius: "16px" } },
    });
    await h.openViaClick();
    const popover = byPart(document, "popover") as HTMLElement;
    expect(popover, "the popover part must be the dialog itself").toBe(
      h.dialog(),
    );
    expect(popover.style.borderRadius).toBe("16px");
    expect(
      popover.style.left,
      "consumer popover styles must not drop the measured offset — guards an off-screen popup",
    ).not.toBe("");
  });

  it("is absent by default, so nothing gains an inline style", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    const day = byPart(h.dialog(), "day", "[data-selected]");
    expect(day, "the selected day must be a day part").toBe(h.dayButton(15));
    expect((day as HTMLElement).getAttribute("style")).toBeNull();
    const input = byPart(h.container, "input");
    expect(input, "the input part must be the textbox itself").toBe(h.input());
    expect((input as HTMLElement).getAttribute("style")).toBeNull();
  });
});
