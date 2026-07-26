import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP 0.2 / Track 2: `styles` completes what `classNames` started —
 * the same anatomy keys, addressed with inline styles for the values a
 * consumer cannot express as a token or a class.
 */
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
    expect(h.container.querySelector('[data-part="root"]')).toHaveStyle({
      maxWidth: "300px",
    });
    expect(h.input()).toHaveStyle({ fontStyle: "italic" });
    expect(h.container.querySelector('[data-part="echo"]')).toHaveStyle({
      color: "rgb(1, 2, 3)",
    });
    await h.openViaClick();
    expect(h.dialog()).toHaveStyle({ borderRadius: "16px" });
    expect(h.dayButton(15)).toHaveStyle({ letterSpacing: "2px" });
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
    expect(h.dayButton(15)).toHaveStyle({
      letterSpacing: "2px",
      fontWeight: "700",
    });
    // Unselected, enabled day keeps only the base entry.
    expect(h.dayButton(17)).toHaveStyle({
      letterSpacing: "2px",
      fontWeight: "400",
    });
    expect(h.dayButton(16)).toHaveStyle({ opacity: "0.2" });
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
    const dialog = h.dialog() as HTMLElement;
    expect(dialog.style.borderRadius).toBe("16px");
    expect(
      dialog.style.left,
      "consumer popover styles must not drop the measured offset — guards an off-screen popup",
    ).not.toBe("");
  });

  it("is absent by default, so nothing gains an inline style", async () => {
    const h = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
    });
    await h.openViaClick();
    expect((h.dayButton(15) as HTMLElement).getAttribute("style")).toBeNull();
    expect((h.input() as HTMLElement).getAttribute("style")).toBeNull();
  });
});
