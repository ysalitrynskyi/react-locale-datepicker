import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";

/**
 * ROADMAP 0.2 / decision D10. The prop half of the theming contract: it
 * stamps the same attribute a CSS-only consumer would write by hand.
 *
 * What the attribute RESOLVES to is a cascade question and cannot be tested
 * in jsdom, which does not implement the cascade — that lives in
 * e2e/themes.spec.ts against real browsers.
 */
describe("themeName prop", () => {
  const root = () => document.querySelector('[data-part="root"]')!;

  it("stamps nothing by default, so an ancestor theme still applies", () => {
    renderPicker({ locale: "en", initialValue: localDate(2026, 6, 15) });
    expect(
      root().hasAttribute("data-rldp-theme"),
      "an unset themeName must not stamp an attribute — that would override an ancestor theme",
    ).toBe(false);
  });

  it("stamps the requested theme on the root", () => {
    renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      themeName: "soft",
    });
    expect(root()).toHaveAttribute("data-rldp-theme", "soft");
  });

  it('treats "default" as an explicit value, not as unset', () => {
    // The two differ: unset inherits an ancestor theme, "default" opts out
    // of one. Collapsing them would remove the only way back to the
    // built-in look inside a themed subtree.
    renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 15),
      themeName: "default",
    });
    expect(root()).toHaveAttribute("data-rldp-theme", "default");
  });

  it("changes nothing else about the rendered picker", async () => {
    // A theme is tokens only. If it started changing structure, the
    // published anatomy would stop being a single contract.
    const plain = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
    });
    await plain.openViaClick();
    const plainParts = Array.from(
      plain.container.querySelectorAll("[data-part]"),
    ).map((n) => n.getAttribute("data-part"));
    plain.unmount();

    const themed = renderPicker({
      locale: "en-US",
      initialValue: localDate(2026, 6, 15),
      themeName: "high-contrast",
    });
    await themed.openViaClick();
    const themedParts = Array.from(
      themed.container.querySelectorAll("[data-part]"),
    ).map((n) => n.getAttribute("data-part"));

    expect(
      themedParts,
      "a theme must be tokens only — it must not add or remove elements",
    ).toEqual(plainParts);
  });
});
