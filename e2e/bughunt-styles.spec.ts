import { expect, test, type Locator, type Page } from "@playwright/test";
import { paintedColor, type Rgb } from "./color";

// Stylesheet regression guards for the 2026-09-30 bug hunt: contrast, focus
// visibility and state precedence, measured on the shipped stylesheet. Each
// test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.

const JULY = "value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date";

const luminance = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const u = v / 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Paints any CSS colour string (oklch, rgb, a box-shadow's colour) to bytes.
const paint = (page: Page, css: string): Promise<Rgb> =>
  page.evaluate((value) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]] as Rgb;
  }, css);

const css = (loc: Locator, prop: string, pseudo?: string) =>
  loc.evaluate(
    (el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p as string),
    [prop, pseudo] as const,
  );

// The colour of a computed box-shadow ("oklch(1 0 0) 0px 0px 0px 4px inset").
const shadowColor = (shadow: string) =>
  shadow.match(/^(\S+\([^)]*\)|#\w+)/)?.[1] ?? shadow;

async function openPicker(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await page.getByRole("textbox").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

// Every shipped theme in both schemes, for every pair docs/THEMING.md lists.
// The bug hunt measured some pairs in the default theme only, and fixing just
// those left the today ring at 1.9:1 to 2.6:1 in minimal and soft: a fix for
// a kind of colour pair has to be checked on every theme that has one.
const THEMES = ["", "minimal", "soft", "high-contrast"];
// high-contrast promises AAA, so its text is held to 7:1 rather than 4.5:1.
const textFloor = (theme: string) => (theme === "high-contrast" ? 7 : 4.5);

for (const scheme of ["light", "dark"] as const) {
  for (const theme of THEMES) {
    const t = theme ? `&themeName=${theme}` : "";
    const q = `locale=en&${JULY}${t}`;
    const name = `${theme || "default"} ${scheme}`;
    const floor = textFloor(theme);

    test(`placeholder reads at ${floor}:1 — ${name} (BH-057)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/?locale=en${t}`);
      const input = page.getByRole("textbox");
      const fg = await paint(page, await css(input, "color", "::placeholder"));
      const bg = await paintedColor(page.locator('[data-part="field"]'));
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor);
    });

    test(`weekday headers read at ${floor}:1 — ${name} (BH-058)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPicker(page, q);
      const fg = await paintedColor(page.locator(".rldp-weekday").first(), "color");
      const bg = await paintedColor(page.getByRole("dialog"));
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor);
    });

    test(`selected day text reads at ${floor}:1 — ${name} (BH-077)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPicker(page, q);
      const day = page.locator(".rldp-day[data-selected]");
      await page.waitForTimeout(200); // background transition
      const fg = await paintedColor(day, "color");
      const bg = await paintedColor(day);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor);
    });

    test(`the open month's text reads at ${floor}:1 — ${name} (BH-077)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPicker(page, q);
      await page.locator('[data-part="month-pill"]').click();
      const month = page.locator(".rldp-month[data-current]");
      await expect(month).toBeVisible();
      await page.waitForTimeout(200);
      const fg = await paintedColor(month, "color");
      const bg = await paintedColor(month);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor);
    });

    test(`keyboard focus on the selected day is visible — ${name} (BH-022, BH-078)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/?${q}`);
      const input = page.getByRole("textbox");
      await input.focus();
      await input.press("ArrowDown");
      await input.press("ArrowDown");
      const day = page.locator(".rldp-day[data-selected]");
      await expect(day).toBeFocused();
      await page.waitForTimeout(200);
      // The indicator is a ring in the ring colour with a band in the fill's
      // foreground just inside it: the band has to stand off the fill, and
      // the ring off the popover, which is all a reset that strips the fill
      // leaves around it.
      const band = await paint(page, shadowColor(await css(day, "box-shadow")));
      const fill = await paintedColor(day);
      expect(contrast(band, fill), "band against the fill").toBeGreaterThanOrEqual(3);
      const ring = await paint(page, await css(day, "outline-color"));
      const surface = await paintedColor(page.getByRole("dialog"));
      expect(contrast(ring, surface), "ring against the popover").toBeGreaterThanOrEqual(3);
    });

    test(`the error border clears 3:1 — ${name} (BH-059)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/?locale=en&hasError=1${t}`);
      const field = page.locator('[data-part="field"]');
      const border = await paintedColor(field, "borderTopColor");
      const bg = await paintedColor(field);
      expect(contrast(border, bg)).toBeGreaterThanOrEqual(3);
    });

    test(`the today ring clears 3:1 — ${name} (BH-082)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.clock.setFixedTime(new Date(2026, 6, 10, 12));
      await openPicker(page, `locale=en&defaultMonth=2026-07-01${t}`);
      const today = page.locator(".rldp-day[data-today]");
      const ring = await paint(page, shadowColor(await css(today, "box-shadow")));
      const bg = await paintedColor(page.getByRole("dialog"));
      expect(contrast(ring, bg)).toBeGreaterThanOrEqual(3);
    });
  }
}

test("focus on the selected day survives a reset that strips its fill (RV-02)", async ({
  page,
}) => {
  await page.goto(`/?locale=en&${JULY}`);
  // Tailwind v3 preflight, unlayered, so it beats the package's layer.
  await page.addStyleTag({ content: "button { background-color: transparent; }" });
  const input = page.getByRole("textbox");
  await input.focus();
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  const day = page.locator(".rldp-day[data-selected]");
  await expect(day).toBeFocused();
  expect(await css(day, "background-color")).toBe("rgba(0, 0, 0, 0)");
  const ring = await paint(page, await css(day, "outline-color"));
  const surface = await paintedColor(page.getByRole("dialog"));
  expect(contrast(ring, surface), "the ring is all that is left to see").toBeGreaterThanOrEqual(3);
});

test("a nearer .dark wins over an outer .light (BH-081)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/?locale=en&${JULY}`);
  await page.evaluate(() => {
    document.body.classList.add("light");
    document.querySelector('[data-testid="harness-root"]')!.classList.add("dark");
  });
  expect(await css(page.locator('[data-part="root"]'), "color-scheme")).toBe("dark");
});

test("focus on an errored field shows (BH-044)", async ({ page }) => {
  await page.goto("/?locale=en&hasError=1");
  await page.getByRole("textbox").focus();
  const field = page.locator('[data-part="field"]');
  expect(await css(field, "outline-style")).toBe("solid");
  // Flush against the border, so the field reads as one heavier red border.
  // Set off by a gap, the ring and the border read as two separate lines.
  expect(await css(field, "outline-offset"), "one border, not two lines").toBe("0px");
});

test("focus on a disabled field shows as a darker border, not a second line (BH-044)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  // The minimal theme's resting border is transparent: the hardest case.
  await page.goto("/?locale=en&themeName=minimal&disabled=1");
  const field = page.locator('[data-part="field"]');
  const bg = await paintedColor(page.locator("body"));
  const resting = await paintedColor(field, "borderTopColor");
  await page.getByRole("textbox").focus();
  const focused = await paintedColor(field, "borderTopColor");
  expect(contrast(focused, bg), "focus must show on a disabled field").toBeGreaterThanOrEqual(3);
  expect(focused).not.toEqual(resting);
  expect(await css(field, "outline-style")).toBe("none");
});

test("a focused, disabled, errored minimal field keeps its error border (BH-044)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?locale=en&themeName=minimal&disabled=1&hasError=1");
  await page.getByRole("textbox").focus();
  const field = page.locator('[data-part="field"]');
  const border = await paintedColor(field, "borderTopColor");
  const bg = await paintedColor(page.locator("body"));
  expect(contrast(border, bg)).toBeGreaterThan(2);
  expect(await css(field, "outline-style")).toBe("solid");
});

test("forced colors keep a field focus cue and grey disabled days (BH-063)", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPicker(page, `locale=en&disableWeekends=1&${JULY}`);
  expect(await css(page.locator('[data-part="field"]'), "outline-style")).toBe("solid");
  const disabled = await css(page.locator(".rldp-day[data-disabled]").first(), "color");
  const enabled = await css(
    page.locator(".rldp-day:not([data-disabled]):not([data-selected])").first(),
    "color",
  );
  expect(disabled).not.toBe(enabled);
});

test("a selected day the predicate rejects keeps its fill (BH-084)", async ({ page }) => {
  // 18 July 2026 is a Saturday.
  await openPicker(page, `locale=en&disableWeekends=1&${JULY}`);
  const day = page.locator(".rldp-day[data-selected][data-disabled]");
  await expect(day).toHaveCount(1);
  await page.waitForTimeout(200);
  const fg = await paintedColor(day, "color");
  const bg = await paintedColor(day);
  expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
});

test("the selected day prints with its colours (BH-083)", async ({ page }) => {
  // Read under screen media. The declaration is not inside a print query, so
  // its computed value is the same either way, and an open calendar cannot
  // be held under emulated print in Firefox: switching the media type blurs
  // the field, which closes the calendar, and with print already on neither
  // a click nor a key opens it. This test used to switch after opening and
  // failed in Firefox for that reason, not because of the stylesheet.
  await openPicker(page, `locale=en&${JULY}`);
  expect(await css(page.locator(".rldp-day[data-selected]"), "print-color-adjust")).toBe(
    "exact",
  );
});

test("200% text at 320px does not scroll the page sideways (BH-079)", async ({
  page,
}, info) => {
  test.skip(!info.project.name.includes("320"), "viewport-specific assertion");
  await page.goto("/?locale=es&value=2026-09-15");
  // The harness heading is one long word that overflows on its own at this
  // size; only the picker is under test.
  await page.addStyleTag({
    content: "html { font-size: 32px } h1, pre { display: none }",
  });
  await page.getByRole("textbox").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const [scrollW, clientW] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollW).toBeLessThanOrEqual(clientW);
});

test.describe("touch tablets", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 900, height: 1100 } });
  test("keep a 16px field so Safari does not zoom (BH-060)", async ({ page }) => {
    await page.goto("/?locale=en");
    expect(await css(page.getByRole("textbox"), "font-size")).toBe("16px");
  });
});

test("a desktop at 900px keeps the 14px density", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/?locale=en");
  expect(await css(page.getByRole("textbox"), "font-size")).toBe("14px");
});
