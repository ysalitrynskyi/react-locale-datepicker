import { expect, type Locator } from "@playwright/test";

/**
 * Colour assertions that do not care what colour space a value is authored
 * in.
 *
 * The palette is authored in `oklch()`, and `getComputedStyle` hands back an
 * `oklch()` string rather than `rgb()` — so comparing computed colour
 * strings literally breaks the moment the palette format changes, which
 * says nothing about whether the rendered colour changed. Painting the value
 * onto a 1x1 canvas and reading the bytes back asks the browser the question
 * we actually mean: what colour does this end up being on screen.
 */
export type Rgb = [number, number, number];

export async function paintedColor(
  locator: Locator,
  property: "backgroundColor" | "color" | "borderTopColor" = "backgroundColor",
): Promise<Rgb> {
  return locator.evaluate((node, prop) => {
    const value = getComputedStyle(node)[prop as "backgroundColor"];
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    // Paint opaque black first so a translucent value composites
    // predictably rather than reading back as undefined bytes.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]] as [number, number, number];
  }, property);
}

export function expectColor(
  actual: Rgb,
  expected: Rgb,
  message: string,
  tolerance = 2,
) {
  const delta = Math.max(...actual.map((c, i) => Math.abs(c - expected[i])));
  expect(
    delta,
    `${message} — got rgb(${actual.join(", ")}), expected about rgb(${expected.join(", ")})`,
  ).toBeLessThanOrEqual(tolerance);
}
