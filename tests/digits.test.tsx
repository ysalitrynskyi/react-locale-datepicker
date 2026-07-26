import { describe, expect, it, vi } from "vitest";
import { renderPicker, isoLocal } from "./helpers";

/**
 * ROADMAP Track 4: typed-digit normalization generalized from two
 * hardcoded Arabic-Indic ranges to a map generated from Intl.NumberFormat.
 *
 * The bug this fixes is not cosmetic. A user whose locale defaults to a
 * numbering system other than latn or the two Arabic-Indic ones could not
 * type a date AT ALL: their digits were not matched by the normalizer, then
 * were removed by the non-digit filter, so the field stayed empty.
 */

/** Render digits 0-9 of a numbering system, via the same API the map uses. */
function digitsOf(numberingSystem: string): string[] {
  const fmt = new Intl.NumberFormat(`en-u-nu-${numberingSystem}`, {
    useGrouping: false,
  });
  return Array.from({ length: 10 }, (_, d) => fmt.format(d));
}

/** "17.07.2026" written in the given numbering system's digits. */
function dateIn(numberingSystem: string): string {
  const d = digitsOf(numberingSystem);
  return [1, 7, 0, 7, 2, 0, 2, 6].map((n) => d[n]).join("");
}

describe("typed digit normalization is derived from Intl", () => {
  // One Latin-script control plus scripts that are a locale default
  // somewhere and were all broken before.
  const systems: [string, string][] = [
    ["arab", "Eastern Arabic-Indic"],
    ["arabext", "Extended Arabic-Indic"],
    ["deva", "Devanagari"],
    ["beng", "Bengali"],
    ["mymr", "Myanmar"],
    ["thai", "Thai"],
  ];

  for (const [system, label] of systems) {
    it(`masks and commits ${label} (${system}) digits`, async () => {
      const typed = dateIn(system);
      // Guard the fixture itself: if the engine has no data for this
      // system it silently returns ASCII, which would make the test pass
      // for the wrong reason.
      if (system !== "latn" && /^[0-9]+$/.test(typed)) {
        expect.fail(
          `test engine has no ${system} digits — fixture would pass vacuously`,
        );
      }

      const onChange = vi.fn();
      const h = renderPicker({ locale: "en", initialValue: null, onChange });
      await h.user.click(h.input());
      await h.user.paste(typed);
      expect(
        (h.input() as HTMLInputElement).value,
        `${label} digits must mask into the display format — guards the hardcoded-range regression`,
      ).toBe("17.07.2026");

      await h.user.tab();
      expect(
        isoLocal(onChange.mock.calls[0]?.[0]),
        `${label} digits must parse to the right local-midnight date`,
      ).toBe("2026-07-17");
    });
  }

  it("ignores letters that an algorithmic numbering system would produce", async () => {
    // Intl formats 1 as "I" under -u-nu-roman. Reading a letter as a digit
    // would corrupt typed input for every Latin-script user, so the map
    // accepts Unicode decimal digits only.
    const h = renderPicker({ locale: "en", initialValue: null });
    await h.user.click(h.input());
    await h.user.paste("IVX");
    expect(
      (h.input() as HTMLInputElement).value,
      "letters must never be read as digits — guards an over-broad digit map",
    ).toBe("");
  });

  it("still strips separators and mixed scripts down to digits", async () => {
    const deva = digitsOf("deva");
    const h = renderPicker({ locale: "en", initialValue: null });
    await h.user.click(h.input());
    // Devanagari 1, ASCII 7, a separator, then the rest mixed.
    await h.user.paste(`${deva[1]}7/${deva[0]}7-2026`);
    expect((h.input() as HTMLInputElement).value).toBe("17.07.2026");
  });

  it("caps at eight digits however they are written", async () => {
    const arab = digitsOf("arab");
    const h = renderPicker({ locale: "ar", initialValue: null });
    await h.user.click(h.input());
    await h.user.paste(arab.slice(1).join("") + arab.join(""));
    expect(
      (h.input() as HTMLInputElement).value.replace(/\./g, "").length,
      "the eight-digit cap must survive the rewrite",
    ).toBe(8);
  });
});
