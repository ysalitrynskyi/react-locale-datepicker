/**
 * Capture README screenshots from the e2e harness (light, dark, RTL).
 * Usage: npm run e2e:harness (elsewhere) is not required — this script
 * starts Vite, shoots, then exits.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
  {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env },
  },
);

try {
  await waitForServer(base);
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  async function shot(name, pathQuery, opts = {}) {
    const page = await browser.newPage({
      viewport: { width: 420, height: 560 },
      colorScheme: opts.colorScheme ?? "light",
    });
    if (opts.emulateDarkClass) {
      await page.addInitScript(() => {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
      });
    }
    await page.goto(`${base}/?${pathQuery}`, { waitUntil: "networkidle" });
    // Hide the harness chrome (heading, state readouts) so stray text does
    // not bleed into the cropped image.
    await page.addStyleTag({
      content: "h1, pre { visibility: hidden; }",
    });
    await page.getByRole("textbox").click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    // An element screenshot of .rldp-root clips to its border box, and the
    // popover is absolutely positioned OUTSIDE that box — shooting the root
    // alone captures just the input field. Clip the page to the union of the
    // field and the open popover instead, with a little breathing room.
    const clip = await page.evaluate(() => {
      const rects = [".rldp-root", ".rldp-popover"].map((s) =>
        document.querySelector(s).getBoundingClientRect(),
      );
      const pad = 8;
      const x = Math.min(...rects.map((r) => r.left)) - pad;
      const y = Math.min(...rects.map((r) => r.top)) - pad;
      return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.max(...rects.map((r) => r.right)) - Math.max(0, x) + pad,
        height: Math.max(...rects.map((r) => r.bottom)) - Math.max(0, y) + pad,
      };
    });
    await page.screenshot({
      path: join(outDir, name),
      animations: "disabled",
      clip,
    });
    await page.close();
    console.log("wrote", name);
  }

  await shot(
    "picker-light.png",
    "locale=en&value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date",
  );
  await shot(
    "picker-dark.png",
    "locale=en&value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date",
    { colorScheme: "dark", emulateDarkClass: true },
  );
  await shot(
    "picker-rtl.png",
    "locale=ar&dir=rtl&value=2026-07-18&defaultMonth=2026-07-01&ariaLabel=Date",
  );

  await browser.close();
} finally {
  vite.kill("SIGTERM");
}
