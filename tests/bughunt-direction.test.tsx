// Regression guards for the 2026-09-30 bug hunt: the documented `direction`
// prop (BH-007) and the direction stamped on the popover (BH-013). Layout
// itself is asserted in e2e/bughunt.spec.ts; jsdom computes no direction.
import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { localDate, renderPicker } from "./helpers";

const root = () => document.querySelector<HTMLElement>('[data-part="root"]')!;

describe("the direction prop (BH-007)", () => {
  it("is absent by default, so the page's direction is inherited", () => {
    renderPicker({ locale: "ar" });
    expect(root().hasAttribute("dir")).toBe(false);
  });

  it.each([
    ["ar", "rtl"],
    ["he", "rtl"],
    ["fa", "rtl"],
    ["ur-PK", "rtl"],
    ["en", "ltr"],
    ["ja", "ltr"],
  ])("auto derives %s as %s", (locale, dir) => {
    renderPicker({ locale, direction: "auto" });
    expect(root()).toHaveAttribute("dir", dir);
  });

  it("an explicit value wins and is stamped on the popover too (BH-013)", async () => {
    const h = renderPicker({
      locale: "en",
      direction: "rtl",
      initialValue: localDate(2026, 6, 15),
      portal: true,
    });
    expect(root()).toHaveAttribute("dir", "rtl");
    await h.openViaClick();
    expect(h.dialog()).toHaveAttribute("dir", "rtl");
  });

  it("arrow keys follow the explicit direction in a portaled grid", async () => {
    const h = renderPicker({
      locale: "en",
      direction: "rtl",
      initialValue: localDate(2026, 6, 15),
      portal: true,
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("data-day")).toBe("2026-6-14");
  });
});
