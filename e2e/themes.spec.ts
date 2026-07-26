import { test, expect, type Page } from "@playwright/test";
import { paintedColor, expectColor } from "./color";

/**
 * Theming behaviour that only a real cascade can prove (decision D10):
 * named themes resolve, they apply from an ancestor, they NEST to the
 * nearest one, and a consumer's own token override reaches the picker.
 *
 * That last one is a 0.1.0 regression test. The README documented setting
 * tokens on an ancestor and it never worked: the stylesheet declared every
 * token on .rldp-root, and an element's own declaration beats an inherited
 * value regardless of cascade layer.
 */

const JULY = "value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date";

async function openPicker(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await page.getByRole("textbox").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

const selectedDay = (page: Page) =>
  page.locator(".rldp-day[data-selected]").first();

test.describe("named themes", () => {
  test("default look is unchanged when no theme is named", async ({ page }) => {
    await openPicker(page, `locale=en&${JULY}`);
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [37, 99, 235],
      "the built-in accent must stay exactly what 0.1.0 shipped",
    );
  });

  test("themeName=soft repaints and reshapes through tokens", async ({
    page,
  }) => {
    await openPicker(page, `locale=en&themeName=soft&${JULY}`);
    await expect(page.locator(".rldp-root")).toHaveAttribute(
      "data-rldp-theme",
      "soft",
    );
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [79, 70, 229],
      "soft must redefine the accent token",
    );
    const radius = await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius, "soft must use the larger popover radius").toBe("16px");
  });

  test("themeName=minimal is borderless at rest but still shows focus", async ({
    page,
  }) => {
    // Measured before opening: clicking the input puts the field in
    // :focus-within, which is supposed to paint a border.
    await page.goto(`/?locale=en&themeName=minimal&${JULY}`);
    const field = page.locator(".rldp-field");
    expect(
      await field.evaluate((el) => getComputedStyle(el).borderTopColor),
      "minimal is borderless at rest — transparent, not zero width, so nothing reflows",
    ).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(
      await field.evaluate((el) => getComputedStyle(el).borderTopWidth),
      "the border keeps its width so the focus ring has somewhere to land",
    ).toBe("2px");

    await page.getByRole("textbox").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expectColor(
      await paintedColor(field, "borderTopColor"),
      [24, 24, 27],
      "a borderless theme must still paint a focus affordance",
    );
  });

  test("themeName=high-contrast thickens the focus indicator", async ({
    page,
  }) => {
    await openPicker(page, `locale=en&themeName=high-contrast&${JULY}`);
    const width = await page
      .locator(".rldp-root")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--rldp-focus-width").trim(),
      );
    expect(
      width,
      "high-contrast must thicken the focus ring — guards a token the theme owns",
    ).toBe("3px");
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [30, 58, 138],
      "high-contrast must use an accent dark enough to carry white text",
    );
  });
});

test.describe("theme resolution", () => {
  test("a theme on an ancestor reaches an unthemed picker", async ({
    page,
  }) => {
    await openPicker(page, `locale=en&ancestorTheme=soft&${JULY}`);
    await expect(page.locator(".rldp-root")).not.toHaveAttribute(
      "data-rldp-theme",
      /./,
    );
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [79, 70, 229],
      "a theme set on an ancestor must apply — themes inherit",
    );
  });

  test("nested themes resolve to the NEAREST one, not to source order", async ({
    page,
  }) => {
    // soft on an ancestor, minimal on the picker itself. Source order in the
    // stylesheet puts minimal before soft, so a descendant-selector
    // implementation would wrongly resolve to soft here.
    await openPicker(
      page,
      `locale=en&ancestorTheme=soft&themeName=minimal&${JULY}`,
    );
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [24, 24, 27],
      "the nearest theme must win — guards resolution by stylesheet order",
    );
  });

  test('themeName="default" opts back out of an ancestor theme', async ({
    page,
  }) => {
    await openPicker(
      page,
      `locale=en&ancestorTheme=soft&themeName=default&${JULY}`,
    );
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [37, 99, 235],
      'themeName="default" must restore the built-in tokens inside a themed subtree',
    );
  });

  test("a token set on an ancestor reaches the picker", async ({ page }) => {
    // Regression for 0.1.0: this is what README theming documented and what
    // did not work, because the stylesheet declared the token on the root.
    await openPicker(
      page,
      `locale=en&ancestorAccent=%23ff0000&${JULY}`,
    );
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [255, 0, 0],
      "an ancestor --rldp-accent must reach the picker — guards the 0.1.0 inheritance bug",
    );
  });

  test("a consumer token beats the theme that would otherwise set it", async ({
    page,
  }) => {
    await openPicker(
      page,
      `locale=en&ancestorTheme=soft&ancestorAccent=%23ff0000&${JULY}`,
    );
    // The accent wrapper is INSIDE the theme wrapper, so it is nearer.
    expectColor(
      await paintedColor(selectedDay(page), "backgroundColor"),
      [255, 0, 0],
      "a nearer explicit token must beat an outer theme",
    );
  });
});
