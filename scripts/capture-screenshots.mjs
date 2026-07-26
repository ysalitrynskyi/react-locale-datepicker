/**
 * Capture README screenshots and the interaction GIF from the e2e harness.
 * Starts Vite itself, shoots, assembles, exits. GIF assembly needs ffmpeg on
 * PATH; when it is missing the stills are still written and the GIF step is
 * skipped with a warning rather than failing the run.
 *
 * Usage: npm run screenshots
 */
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "assets");
const base = "http://127.0.0.1:5173";

async function waitForServer(url, ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start: ${url}`);
}

const vite = spawn(
  "npx",
  ["vite", "--config", "e2e/harness/vite.config.ts"],
  { cwd: root, stdio: "pipe", env: { ...process.env } },
);

// Breathing room around the union of field + popover. The popover shadow
// reaches ~25px past its border box; a smaller pad slices the shadow and
// the images read as "cut".
const PAD = 28;

// Center the picker column on a soft backdrop so the field is as wide as
// the popover and both sit symmetrically — the raw harness stretches the
// field across the whole viewport, which crops lopsided. Also hides the
// harness chrome (heading, state readouts).
const stageCss = (dark) => `
  h1, pre { display: none; }
  body {
    margin: 0;
    padding: 24px 0 0;
    background: ${dark ? "#030712" : "#f1f5f9"};
  }
  [data-testid="harness-root"] { max-width: 336px; margin: 0 auto; }
`;

try {
  await waitForServer(base);
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  /**
   * One still. `prepare(page)` runs after the popover is open — click into
   * a different view, restyle, and so on. An element screenshot of
   * .rldp-root would clip the popover away (it is positioned outside the
   * root's border box), so the page is clipped to the union of both boxes.
   */
  async function shot(name, pathQuery, opts = {}) {
    const page = await browser.newPage({
      viewport: { width: opts.width ?? 420, height: 620 },
      colorScheme: opts.colorScheme ?? "light",
    });
    if (opts.emulateDarkClass) {
      await page.addInitScript(() => {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
      });
    }
    await page.goto(`${base}/?${pathQuery}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: stageCss(opts.dark) });
    if (opts.css) await page.addStyleTag({ content: opts.css });
    await page.getByRole("textbox").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    if (opts.prepare) await opts.prepare(page);
    const clip = await page.evaluate((pad) => {
      const rects = [".rldp-root", ".rldp-popover"].map((s) =>
        document.querySelector(s).getBoundingClientRect(),
      );
      const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - pad);
      const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - pad);
      return {
        x,
        y,
        width: Math.max(...rects.map((r) => r.right)) - x + pad,
        height: Math.max(...rects.map((r) => r.bottom)) - y + pad,
      };
    }, PAD);
    await page.screenshot({
      path: join(outDir, name),
      animations: "disabled",
      clip,
    });
    await page.close();
    console.log("wrote", name);
  }

  const july = "value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date";

  await shot("picker-light.png", `locale=en&${july}`);
  await shot("picker-dark.png", `locale=en&${july}`, {
    colorScheme: "dark",
    emulateDarkClass: true,
    dark: true,
  });
  await shot("picker-rtl.png", `locale=ar&dir=rtl&${july}`);
  await shot("picker-months.png", `locale=en&${july}`, {
    prepare: (page) => page.getByRole("button", { name: "July", exact: true }).click(),
  });
  await shot("picker-years.png", `locale=en&${july}`, {
    prepare: (page) => page.getByRole("button", { name: "2026", exact: true }).click(),
  });
  await shot(
    "picker-disabled-days.png",
    `locale=en&disableWeekends=1&${july}`,
  );
  await shot("picker-error.png", `locale=en&hasError=1&${july}`);
  await shot("picker-themed.png", `locale=en&${july}`, {
    // Everything visual routes through --rldp-* tokens; this is the
    // "custom theme" proof for the README.
    css: `.rldp-root {
      --rldp-accent: #7c3aed;
      --rldp-accent-hover: #6d28d9;
      --rldp-accent-soft: #f3e8ff;
      --rldp-accent-soft-foreground: #6d28d9;
      --rldp-today-ring: #a78bfa;
      --rldp-ring: #7c3aed;
      --rldp-radius: 0.75rem;
    }`,
  });
  await shot("picker-locale-ja.png", `locale=ja&${july}`);
  await shot("picker-mobile.png", `locale=en&${july}`, { width: 320 });

  // --- Interaction GIF ----------------------------------------------------
  // Fixed-size frames (a GIF cannot change dimensions mid-stream), stitched
  // by ffmpeg with a generated palette. Sequence: open, keyboard focus into
  // the grid, months view, pick a month, commit a day, echo under the field.
  const haveFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
  if (!haveFfmpeg) {
    console.warn("ffmpeg not found - skipping picker-demo.gif");
  } else {
    const frameDir = await mkdtemp(join(tmpdir(), "rldp-gif-"));
    const page = await browser.newPage({
      viewport: { width: 420, height: 620 },
      colorScheme: "light",
    });
    // Weekends disabled so the GIF demonstrates shouldDisableDate blocking.
    await page.goto(
      `${base}/?locale=en&disableWeekends=1&defaultMonth=2026-07-01&ariaLabel=Date`,
      { waitUntil: "networkidle" },
    );
    await page.addStyleTag({ content: stageCss(false) });

    // A GIF cannot change dimensions between frames, so measure the clip
    // once at maximum extent (popover open) and reuse it for every frame.
    const input = page.getByRole("textbox");
    await input.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    const clip = await page.evaluate((pad) => {
      const rects = [".rldp-root", ".rldp-popover"].map((s) =>
        document.querySelector(s).getBoundingClientRect(),
      );
      const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - pad);
      const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - pad);
      return {
        x,
        y,
        width: Math.max(...rects.map((r) => r.right)) - x + pad,
        height: Math.max(...rects.map((r) => r.bottom)) - y + pad,
      };
    }, PAD);
    // The long-form echo does not exist yet at measure time; once a value
    // commits it appears under the field and pushes the reopened popover
    // down by roughly one small line. Reserve that room so later frames do
    // not clip the popover shadow.
    clip.height += 22;
    await page.keyboard.press("Escape"); // back to the starting state

    let n = 0;
    const snap = async () => {
      await page.screenshot({
        path: join(frameDir, `f${String(n++).padStart(2, "0")}.png`),
        animations: "disabled",
        clip,
      });
    };

    await snap(); // empty focused field
    await input.click(); // opens the calendar
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await input.pressSequentially("1707");
    await snap(); // digits mask to 17.07 while the calendar is open
    await input.pressSequentially("2026");
    await snap(); // full masked date 17.07.2026
    await page.keyboard.press("Enter");
    await page.locator(".rldp-echo").waitFor({ state: "visible" });
    await snap(); // Enter commits the typed date; long-form echo appears
    await input.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await snap(); // reopened: 17 selected, weekends greyed out
    // force: Playwright's actionability check refuses aria-disabled targets,
    // but a real pointer can hit them — the component swallows the click,
    // which is exactly what this frame demonstrates.
    await page.getByRole("button", { name: /^18 / }).click({ force: true });
    await snap(); // clicking disabled Saturday 18 changes nothing
    await page.getByRole("button", { name: "July", exact: true }).click();
    await snap(); // month view
    await page.getByRole("button", { name: "August", exact: true }).click();
    await snap(); // days view on August
    await page.getByRole("button", { name: /^24 / }).click();
    await page
      .locator(".rldp-echo", { hasText: "August" })
      .waitFor({ state: "visible" });
    await snap(); // one-tap commit on Monday 24 August; closed with echo
    await snap(); // duplicate to hold the final state longer
    await page.close();

    const gif = join(outDir, "picker-demo.gif");
    const ff = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-framerate",
        "1.25",
        "-i",
        join(frameDir, "f%02d.png"),
        "-vf",
        "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        "-loop",
        "0",
        gif,
      ],
      { stdio: "pipe" },
    );
    if (ff.status === 0) console.log("wrote picker-demo.gif");
    else console.error("ffmpeg failed:", ff.stderr?.toString().slice(-500));
    await rm(frameDir, { recursive: true, force: true });
  }

  await browser.close();
} finally {
  vite.kill("SIGTERM");
}
