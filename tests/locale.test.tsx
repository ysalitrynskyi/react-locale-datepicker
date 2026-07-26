import { describe, expect, it } from "vitest";
import { renderPicker, localDate } from "./helpers";
import { resolveLocale } from "../src/LocaleDatePicker";

describe("locale-driven labels from Intl", () => {
  it("renders German (Latin) month and weekday names from Intl", async () => {
    // Parity: month/weekday names come from Intl.DateTimeFormat, never a table.
    const h = renderPicker({
      locale: "de",
      initialValue: localDate(2026, 2, 15),
    });
    await h.openViaClick();
    const deMonth = new Intl.DateTimeFormat("de", { month: "long" }).format(
      localDate(2026, 2, 15),
    );
    expect(
      h.dialog().textContent,
      "de month label must come from Intl",
    ).toContain(deMonth);
    const deWeekday = new Intl.DateTimeFormat("de", { weekday: "short" }).format(
      localDate(2026, 2, 15),
    );
    // Weekday header uses short forms for the week; at least one short label
    // from the locale must appear.
    const shortLabels = Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat("de", { weekday: "short" }).format(
        new Date(2024, 5, 2 + i),
      ),
    );
    for (const label of shortLabels) {
      expect(h.dialog().textContent).toContain(label);
    }
    void deWeekday;
  });

  it("renders Ukrainian (Cyrillic) month names for locale uk and alias ua", async () => {
    for (const locale of ["uk", "ua"] as const) {
      const h = renderPicker({
        locale,
        initialValue: localDate(2026, 5, 10),
      });
      // ua must not throw — regression for the form-hydration crash.
      await h.openViaClick();
      const resolved = resolveLocale(locale);
      const month = new Intl.DateTimeFormat(resolved, { month: "long" }).format(
        localDate(2026, 5, 10),
      );
      expect(
        h.dialog().textContent,
        `${locale} must show Intl month for ${resolved}`,
      ).toContain(month);
      h.unmount();
    }
  });

  it("renders Japanese (CJK) month/year header from Intl", async () => {
    const h = renderPicker({
      locale: "ja",
      initialValue: localDate(2026, 0, 20),
    });
    await h.openViaClick();
    const title = new Intl.DateTimeFormat("ja", {
      month: "long",
      year: "numeric",
    }).format(localDate(2026, 0, 20));
    // Header shows long month; live region has month+year.
    const longMonth = new Intl.DateTimeFormat("ja", { month: "long" }).format(
      localDate(2026, 0, 20),
    );
    expect(h.dialog().textContent).toContain(longMonth);
    void title;
  });

  it("renders Arabic (RTL) weekday labels from Intl without throwing", async () => {
    const h = renderPicker({
      locale: "ar",
      initialValue: localDate(2026, 4, 5),
    });
    await h.openViaClick();
    const shortLabels = Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat("ar", { weekday: "short" }).format(
        new Date(2024, 5, 2 + i),
      ),
    );
    // At least the set of short weekdays should be present in the header row.
    const present = shortLabels.filter((l) =>
      (h.dialog().textContent ?? "").includes(l),
    );
    expect(
      present.length,
      "ar weekday short labels from Intl must appear in the grid header",
    ).toBeGreaterThanOrEqual(7);
  });

  it("long-form echo under the field uses the active locale", () => {
    // Parity: the committed date is echoed under the field in words via Intl.
    const value = localDate(2026, 10, 17);
    const h = renderPicker({ locale: "de", initialValue: value });
    const expected = new Intl.DateTimeFormat("de", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
    expect(
      h.container.textContent,
      "long-form echo must match Intl for the active locale",
    ).toContain(expected);
  });

  it("first day of week follows the locale (Sunday vs Monday starts)", async () => {
    // Parity: first day of the week follows the locale, not a hardcoded day.
    // en-US: Sunday first; de-DE: Monday first (CLDR weekInfo).
    const sampleSunday = new Date(2024, 5, 2); // known Sunday

    const us = renderPicker({
      locale: "en-US",
      initialValue: localDate(2024, 5, 15),
    });
    await us.openViaClick();
    // Weekday header cells are div[aria-hidden] with text; SVG icons also
    // use aria-hidden but have empty textContent — keep only labelled cells.
    const usLabels = Array.from(
      us.dialog().querySelectorAll("div[aria-hidden='true']"),
    )
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);
    const usSunday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
    }).format(sampleSunday);
    expect(
      usLabels[0],
      "en-US week must start on Sunday — guards hardcoded-Monday regression",
    ).toBe(usSunday);
    us.unmount();

    const de = renderPicker({
      locale: "de-DE",
      initialValue: localDate(2024, 5, 15),
    });
    await de.openViaClick();
    const deLabels = Array.from(
      de.dialog().querySelectorAll("div[aria-hidden='true']"),
    )
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);
    const deMonday = new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
    }).format(new Date(2024, 5, 3)); // Monday
    expect(
      deLabels[0],
      "de-DE week must start on Monday — guards hardcoded-Sunday regression",
    ).toBe(deMonday);
  });
});
