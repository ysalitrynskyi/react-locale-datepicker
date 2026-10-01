import { expect, test, type Page } from "@playwright/test";

// Real-layout regression guards for the 2026-09-30 bug hunt: everything here
// depends on the cascade, computed direction, or geometry, which jsdom cannot
// measure. Each test names the ledger entry (docs/bug-hunts/2026-09-30.md).

async function open(page: Page, query: string) {
  await page.goto(`/?${query}`);
  const input = page.getByRole("textbox");
  await input.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return input;
}

const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

test.describe("direction", () => {
  test("direction=auto lays an Arabic picker out RTL on an LTR page (BH-007)", async ({
    page,
  }) => {
    await page.goto("/?locale=ar&dir=ltr&direction=auto&value=2026-07-15");
    await expect(page.locator('[data-part="root"]')).toHaveAttribute("dir", "rtl");
  });

  test("a portaled grid keeps the field's RTL direction for layout and keys (BH-013)", async ({
    page,
  }) => {
    const input = await open(page, "locale=en&dir=ltr&wrapDir=rtl&portal=1&value=2026-07-15");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("dir", "rtl");
    // Columns reversed: the first weekday header sits right of the last.
    const heads = dialog.locator('[data-part="weekday"]');
    const first = await heads.first().boundingBox();
    const last = await heads.last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
    await input.press("ArrowDown");
    await expect(page.locator('[data-day="2026-6-15"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-day="2026-6-14"]')).toBeFocused();
  });

  test("an ancestor dir=auto that resolves RTL flips the chevrons (BH-062)", async ({
    page,
  }) => {
    await open(page, "locale=en&dir=ltr&wrapDir=auto&value=2026-07-15");
    const t = await page
      .locator('[data-part="nav-icon"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(t).toContain("matrix(-1");
  });

  test("in RTL the calendar opens from the field's right edge (BH-061)", async ({
    page,
  }, info) => {
    test.skip(!info.project.name.includes("1280"), "needs a field wider than the calendar");
    await open(page, "locale=en&dir=ltr&wrapDir=rtl&value=2026-07-15");
    const root = await page.locator('[data-part="root"]').boundingBox();
    const pop = await page.getByRole("dialog").boundingBox();
    // The start (right) edge of the field, kept 8px inside the viewport.
    const want = Math.min(root!.x + root!.width, page.viewportSize()!.width - 8);
    expect(Math.abs(want - (pop!.x + pop!.width))).toBeLessThan(2);
    // And not the physical left of the field, where it used to open.
    expect(pop!.x - root!.x).toBeGreaterThan(100);
  });
});

test.describe("portaled popover", () => {
  test("follows the field when content above it moves it (BH-019)", async ({ page }) => {
    await open(page, "locale=en&portal=1&value=2026-07-15");
    await page.evaluate(() => {
      const block = document.createElement("div");
      block.style.height = "120px";
      block.dataset.testid = "pushed";
      document.querySelector('[data-part="root"]')!.before(block);
    });
    await nextFrames(page);
    const field = await page.locator('[data-part="root"]').boundingBox();
    const pop = await page.getByRole("dialog").boundingBox();
    const placement = await page.getByRole("dialog").getAttribute("data-placement");
    if (placement === "bottom") {
      expect(Math.abs(pop!.y - (field!.y + field!.height + 4))).toBeLessThan(3);
    } else {
      expect(Math.abs(pop!.y + pop!.height + 4 - field!.y)).toBeLessThan(3);
    }
  });

  test("picks up a theme toggled while open (BH-020)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "locale=en&portal=1&value=2026-07-15");
    const before = await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await nextFrames(page);
    const after = await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);
  });

  test("inherits the field's font (BH-049)", async ({ page }) => {
    await open(page, "locale=en&portal=1&ancestorFont=Georgia&value=2026-07-15");
    const font = await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain("Georgia");
  });

  test("is border-box and fits a 320px viewport (BH-021)", async ({ page }, info) => {
    test.skip(!info.project.name.includes("320"), "viewport-specific assertion");
    await open(page, "locale=en&portal=1&value=2026-07-15");
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate((el) => getComputedStyle(el).boxSizing)).toBe("border-box");
    const box = await dialog.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });

  test("stays inside a short viewport when it flips above the field (BH-052)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 420 });
    await page.goto("/?locale=en&portal=1&value=2026-07-15");
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "300px";
      document.querySelector('[data-part="root"]')!.before(spacer);
    });
    await page.getByRole("textbox").click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(420);
  });
});
