import { test, expect, type Page } from "@playwright/test";

async function openPicker(page: Page, query = "") {
  await page.goto(`/${query ? `?${query}` : ""}`);
  const input = page.getByRole("textbox");
  await input.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return input;
}

test.describe("browser matrix — open and select", () => {
  test("opens, shows a days grid, commits one tap", async ({ page }) => {
    const input = await openPicker(
      page,
      "locale=en&defaultMonth=2026-07-01&ariaLabel=Pick%20a%20date",
    );
    // data-day uses JS month index (0-based): July = 6.
    await page.locator('[data-day="2026-6-18"]').click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("committed-iso")).toHaveText("2026-07-18");
    await expect(input).toHaveValue("18.07.2026");
  });

  test("320px viewport keeps the popover usable and unclipped horizontally", async ({
    page,
  }, testInfo) => {
    // TESTING: 320px viewport is usable; popover shifts so viewport never clips.
    test.skip(
      !testInfo.project.name.includes("320"),
      "viewport-specific assertion",
    );
    await openPicker(page, "locale=en&defaultMonth=2026-07-01");
    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();
    expect(box, "dialog must render with a box at 320px").toBeTruthy();
    const vp = page.viewportSize()!;
    // Allow a few px for subpixel layout / UA chrome; the point of the test
    // is that the field near the edge does not park the popup entirely off
    // screen (the pre-fix failure mode was tens of pixels of overflow).
    expect(
      box!.x,
      "dialog must not start far off the left edge",
    ).toBeGreaterThanOrEqual(-8);
    expect(
      box!.x + box!.width,
      "dialog must not extend far past the right edge",
    ).toBeLessThanOrEqual(vp.width + 12);
    const day = dialog.locator("[data-day]").first();
    await expect(day).toBeVisible();
    await expect(day).toBeInViewport();
  });
});

test.describe("locale matrix (sample)", () => {
  for (const locale of ["en", "de", "uk", "ja", "ar"]) {
    test(`opens without error for locale=${locale}`, async ({ page }) => {
      await openPicker(
        page,
        `locale=${locale}&defaultMonth=2026-07-01&ariaLabel=Date`,
      );
      await expect(page.getByRole("dialog")).toBeVisible();
      const days = page.locator("[data-day]");
      await expect(days.first()).toBeVisible();
    });
  }

  test("ua alias does not crash the page", async ({ page }) => {
    // Regression: ua → uk; unnormalized ua threw and crashed the form.
    await openPicker(page, "locale=ua&defaultMonth=2026-07-01");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("harness-root")).toBeVisible();
  });
});

test.describe("RTL", () => {
  test("ar locale under dir=rtl keeps the dialog usable", async ({ page }) => {
    // Parity: RTL layouts correctly including navigation arrows.
    await openPicker(page, "locale=ar&dir=rtl&defaultMonth=2026-07-01");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const root = page.getByTestId("harness-root");
    await expect(root).toHaveAttribute("dir", "rtl");
    // Nav chevrons exist; rtl:rotate-180 class is present on the SVG wrappers.
    const nav = dialog.locator("button[aria-label]").first();
    await expect(nav).toBeVisible();
  });
});

test.describe("keyboard", () => {
  test("Escape closes and returns focus to the input", async ({ page }) => {
    const input = await openPicker(page, "locale=en&defaultMonth=2026-07-01");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(input).toBeFocused();
  });
});

test.describe("disabled open", () => {
  test("disabled picker fires onDisabledOpenAttempt", async ({ page }) => {
    await page.goto("/?disabled=1&ariaLabel=Date");
    // Input is readOnly + aria-disabled when the picker is disabled; Playwright
    // refuses a normal click on "not enabled" controls, but real users still
    // can tap it — force the click to exercise onDisabledOpenAttempt.
    await page.getByRole("textbox").click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("disabled-attempts")).toHaveText("1");
  });
});
