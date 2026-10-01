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
    const field = await page.locator('[data-part="field"]').boundingBox();
    expect(box!.y + box!.height, "never over the field (RV-01)").toBeLessThanOrEqual(field!.y);
  });

  test("keeps to its side of the field when the viewport shrinks under it (RV-01)", async ({
    page,
  }) => {
    // An on-screen keyboard that resizes the page does exactly this.
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "locale=en&portal=1&value=2026-07-15");
    const dialog = page.getByRole("dialog");
    const field = (await page.locator('[data-part="field"]').boundingBox())!;
    const opened = (await dialog.boundingBox())!;
    expect(opened.y).toBeGreaterThanOrEqual(field.y + field.height);

    // Short enough that the calendar no longer fits below the field.
    const height = Math.round(opened.y + opened.height * 0.6);
    await page.setViewportSize({ width: 412, height });
    await nextFrames(page);
    await nextFrames(page);
    const box = (await dialog.boundingBox())!;
    expect(box.y, "the calendar must not slide over the field being typed in").toBeGreaterThanOrEqual(
      field.y + field.height,
    );
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    const scrolls = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls, "what no longer fits scrolls inside").toBe(true);
  });

  test("opens beside the field, not over it, on a phone in landscape (RV-01)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await open(page, "locale=en&portal=1&value=2026-07-15");
    const box = (await page.getByRole("dialog").boundingBox())!;
    const field = (await page.locator('[data-part="field"]').boundingBox())!;
    const above = box.y + box.height <= field.y + 0.5;
    const below = box.y >= field.y + field.height - 0.5;
    expect(above || below, `dialog ${box.y}-${box.y + box.height}, field ${field.y}-${field.y + field.height}`).toBe(true);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(360);
  });

  test("runs past the viewport edge instead of shrinking to nothing (RV-07)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 800 });
    await page.goto("/?locale=en&portal=1&value=2026-07-15");
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "560px";
      document.querySelector('[data-part="root"]')!.before(spacer);
      const tail = document.createElement("div");
      tail.style.height = "1500px";
      document.body.append(tail);
    });
    await page.getByRole("textbox").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("data-placement", "top");

    // Scroll the field to the top of the viewport: the side the calendar
    // opened toward has no room left at all.
    const opened = (await page.locator('[data-part="field"]').boundingBox())!;
    await page.evaluate((dy) => window.scrollBy(0, dy), opened.y - 14);
    await nextFrames(page);
    await nextFrames(page);
    const field = (await page.locator('[data-part="field"]').boundingBox())!;
    expect(field.y).toBeLessThan(20);
    const box = (await dialog.boundingBox())!;
    // Capped to that room it was an empty strip of padding and border, and
    // because a box cannot be shorter than those, the strip sat on the field.
    expect(box.y + box.height, "never over the field").toBeLessThanOrEqual(field.y + 0.5);
    expect(box.height, "not squeezed to a strip").toBeGreaterThanOrEqual(100);
  });
});

test.describe("typing", () => {
  // Real keystrokes with a real caret. The unit suite sets the value with
  // fireEvent.change, which cannot show whether Backspace actually works.
  test("Backspace erases a trailing separator, then the digits before it", async ({
    page,
  }) => {
    await page.goto("/?locale=en");
    const input = page.getByRole("textbox");
    await input.click();
    await page.keyboard.type("1.");
    await expect(input).toHaveValue("01.");
    await page.keyboard.press("Backspace");
    await expect(input, "Backspace over the separator must remove it").toHaveValue("01");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(input).toHaveValue("");
    await page.keyboard.type("15.03.2026");
    await expect(input).toHaveValue("15.03.2026");
  });
});
