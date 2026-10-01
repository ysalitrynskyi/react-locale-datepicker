import { expect, test, type Page } from "@playwright/test";
import { expectColor, paintedColor } from "./color";

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
    // Parity: navigation arrows point backwards under RTL. The shipped
    // stylesheet rotates .rldp-nav-icon 180deg inside [dir="rtl"].
    const navIcon = dialog.locator(".rldp-nav-icon").first();
    await expect(navIcon).toBeVisible();
    const transform = await navIcon.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    // rotate(180deg) computes to matrix(-1, 0, 0, -1, 0, 0).
    expect(transform).toContain("matrix(-1");
  });
});

test.describe("dark mode", () => {
  test("OS dark preference flips the popover surface via light-dark()", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openPicker(page, "locale=en&defaultMonth=2026-07-01");
    // The dark half of --rldp-background. Asserted as a painted colour, not
    // as a computed string: the palette is authored in oklch(), and the
    // rendered colour is what this test is actually about.
    expectColor(
      await paintedColor(page.getByRole("dialog")),
      [17, 24, 39],
      "OS dark preference must flip the popover surface via light-dark()",
    );
  });

  test("a [data-theme=dark] ancestor overrides a light OS preference", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openPicker(page, "locale=en&defaultMonth=2026-07-01");
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark"),
    );
    expectColor(
      await paintedColor(page.getByRole("dialog")),
      [17, 24, 39],
      "a [data-theme=dark] ancestor must win over a light OS preference",
    );
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

test.describe("overflow:hidden containment", () => {
  test("in-tree popover is clipped by an overflow:hidden ancestor", async ({
    page,
  }, testInfo) => {
    // Run once per browser (1280) — the clip is geometry, not viewport.
    test.skip(
      !testInfo.project.name.includes("1280"),
      "geometry assertion — one viewport is enough",
    );
    await openPicker(
      page,
      "locale=en&defaultMonth=2026-07-01&overflowHidden=1&showEcho=0",
    );
    // This hit-tests; it does not measure. getBoundingClientRect() is layout
    // and ignores overflow, so a calendar taller than the card overlaps the
    // card's box whether it is clipped or painted in full beneath it — a rect
    // comparison cannot tell the two apart. What a clip changes is what can be
    // pointed at: elementFromPoint() skips the clipped region and returns
    // whatever sits beneath, which is the behaviour the portal prop exists to
    // escape.
    const probe = await page.evaluate(async () => {
      // The in-tree popover nudges the page from a requestAnimationFrame
      // (scrollIntoView). Let that settle so the probe sees the state a
      // visitor is left with, not the frame before it.
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      const card = document.querySelector<HTMLElement>(
        "[data-testid='overflow-card']",
      );
      const dialog = document.querySelector<HTMLElement>("[role='dialog']");
      if (!card || !dialog) return null;

      // The centre of every day button, and what the browser hits there.
      const hitTestDays = () => {
        const c = card.getBoundingClientRect();
        const days = Array.from(
          dialog.querySelectorAll<HTMLElement>("[data-day]"),
        );
        return days.map((day) => {
          const r = day.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            day: day.getAttribute("data-day"),
            // Past the card's border box, so past its clip edge as well.
            beyondCard: x < c.left || x > c.right || y < c.top || y > c.bottom,
            // elementFromPoint() answers null off screen, which must not be
            // mistaken for "clipped".
            onScreen:
              x >= 0 &&
              y >= 0 &&
              x < window.innerWidth &&
              y < window.innerHeight,
            hitDay: hit === day,
            hitDialog: hit !== null && dialog.contains(hit),
          };
        });
      };

      const clipped = hitTestDays();
      // Control: lift the clip and probe again. Every day must now be
      // reachable, so a miss above is the clip and not something else (a
      // popover with pointer-events: none would "pass" the check above too).
      card.style.overflow = "visible";
      const unclipped = hitTestDays();

      return {
        insideCard: card.contains(dialog),
        portaled: dialog.getAttribute("data-portaled"),
        clipped,
        unclipped,
      };
    });
    expect(probe, "card and dialog must both exist").toBeTruthy();
    expect(
      probe!.insideCard,
      "default popover is a DOM child of the overflow card",
    ).toBe(true);
    expect(probe!.portaled).toBeNull();

    // Only a day whose centre lies past the card can show a clip; one inside
    // the card is legitimately reachable.
    const pastCard = probe!.clipped.filter((d) => d.beyondCard && d.onScreen);
    expect(
      pastCard.length,
      "most of the calendar hangs below the 72px card — without days out there the hit-test proves nothing",
    ).toBeGreaterThan(14);
    expect(
      pastCard.filter((d) => d.hitDialog).map((d) => d.day),
      "days past the card must not be hit: an absolute popover is clipped by overflow:hidden — if this fails, the portal prop is unnecessary and D17 should be revisited",
    ).toEqual([]);

    const reachable = probe!.unclipped.filter((d) => d.onScreen);
    expect(
      reachable.length,
      "with the clip lifted the whole calendar must be on screen",
    ).toBeGreaterThan(20);
    expect(
      reachable.filter((d) => !d.hitDay).map((d) => d.day),
      "control: with the clip lifted every day is reachable, so the misses above are the clip",
    ).toEqual([]);
  });

  test("portal=1 escapes overflow:hidden and keeps the calendar fully visible", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("1280"),
      "geometry assertion — one viewport is enough",
    );
    await openPicker(
      page,
      "locale=en&defaultMonth=2026-07-01&overflowHidden=1&portal=1&showEcho=0",
    );
    const metrics = await page.evaluate(() => {
      const card = document.querySelector("[data-testid='overflow-card']");
      const dialog = document.querySelector("[role='dialog']");
      if (!card || !dialog) return null;
      const c = card.getBoundingClientRect();
      const d = dialog.getBoundingClientRect();
      const visibleH = Math.max(
        0,
        Math.min(d.bottom, c.bottom) - Math.max(d.top, c.top),
      );
      return {
        dialogHeight: d.height,
        visibleHeight: visibleH,
        insideCard: card.contains(dialog),
        onBody: dialog.parentElement === document.body,
        portaled: dialog.getAttribute("data-portaled"),
        dayCount: dialog.querySelectorAll("[data-day]").length,
      };
    });
    expect(metrics).toBeTruthy();
    expect(metrics!.insideCard).toBe(false);
    expect(metrics!.onBody).toBe(true);
    expect(metrics!.portaled).toBe("true");
    expect(
      metrics!.dialogHeight,
      "portaled calendar must render at full height",
    ).toBeGreaterThan(200);
    // Fully outside the card's clip rect — intersection with the card may
    // be partial (the field still sits in the card) but days must be
    // clickable. Assert the grid is present and a day is in the viewport.
    expect(metrics!.dayCount).toBeGreaterThan(20);
    const day = page.locator("[role='dialog'] [data-day]").nth(10);
    await expect(day).toBeVisible();
    await expect(day).toBeInViewport();
    await day.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("committed-iso")).not.toHaveText("");
  });
});
