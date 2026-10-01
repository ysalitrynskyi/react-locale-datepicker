// Regression guards for the 2026-09-30 bug hunt, locale half. Each test names
// the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocaleDatePicker, resolveLocale } from "../src/LocaleDatePicker";
import { localDate, renderPicker } from "./helpers";

describe("resolveLocale matches the alias on the language subtag (BH-001)", () => {
  it.each([
    ["UA", "uk"],
    ["Ua", "uk"],
    ["uA", "uk"],
    ["ua-UA", "uk-UA"],
    ["UA-ua", "uk-UA"],
  ])("%s resolves to %s, not to a silently-English unknown tag", (raw, want) => {
    expect(resolveLocale(raw)).toBe(want);
    const month = new Intl.DateTimeFormat(resolveLocale(raw), {
      calendar: "gregory",
      month: "long",
    }).format(new Date(2026, 7, 12));
    expect(month, `${raw} must format in Ukrainian`).toBe("серпень");
  });

  it("canonicalizes case without changing a real tag's meaning", () => {
    expect(resolveLocale("de-de")).toBe("de-DE");
    expect(resolveLocale("EN")).toBe("en");
  });
});


describe("one numbering system everywhere (BH-054)", () => {
  it("an Arabic locale writes the echo, title and years in the field's Latin digits", async () => {
    const h = renderPicker({ locale: "ar", initialValue: localDate(2026, 5, 15) });
    const echo = document.querySelector('[data-part="echo"]')!.textContent!;
    expect(echo).toContain("2026");
    expect(echo).not.toMatch(/[٠-٩]/);
    await h.openViaClick();
    const live = h.dialog().querySelector('[data-part="live-region"]')!.textContent!;
    const pill = h.dialog().querySelector('[data-part="year-pill"]')!.textContent!;
    expect(live).toContain("2026");
    expect(pill).toContain("2026");
  });

  it("an explicit -u-nu- tag localizes every number but the typed field", async () => {
    const h = renderPicker({
      locale: "ar-u-nu-arab",
      initialValue: localDate(2026, 5, 15),
    });
    expect((h.input() as HTMLInputElement).value).toBe("15.06.2026");
    await h.openViaClick();
    const pill = h.dialog().querySelector('[data-part="year-pill"]')!.textContent!;
    const live = h.dialog().querySelector('[data-part="live-region"]')!.textContent!;
    expect(pill).toContain("٢٠٢٦");
    expect(live).toContain("٢٠٢٦");
    expect(h.dialog().querySelector('[data-day="2026-5-15"]')!.textContent).toBe("١٥");
  });
});

describe("day names keep the units Intl attaches (BH-067)", () => {
  it.each([
    ["ja", "31日 土曜日 1月 2026年"],
    ["zh-CN", "31日 星期六 1月 2026年"],
    ["ko", "31일 토요일 1월 2026년"],
    ["en", "31 Saturday January 2026"],
  ])("%s names 31 January 2026 as %s", async (locale, name) => {
    const h = renderPicker({ locale, initialValue: localDate(2026, 0, 31) });
    await h.openViaClick();
    expect(h.dialog().querySelector('[data-day="2026-0-31"]')).toHaveAttribute(
      "aria-label",
      name,
    );
  });
});

describe("Intl text carries its language (BH-069)", () => {
  it("stamps lang on the echo and the popover, not on the consumer's label", async () => {
    const h = renderPicker({
      locale: "uk",
      initialValue: localDate(2026, 6, 17),
      "aria-label": "Date",
    });
    expect(document.querySelector('[data-part="echo"]')).toHaveAttribute("lang", "uk");
    expect(document.querySelector('[data-part="root"]')).not.toHaveAttribute("lang");
    await h.openViaClick();
    expect(h.dialog()).toHaveAttribute("lang", "uk");
    expect(h.dialog().querySelector('[data-part="keyboard-help"]')).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("an unknown tag is labelled with the language Intl actually used", () => {
    renderPicker({ locale: "zz-ZZ", initialValue: localDate(2026, 6, 17) });
    const lang = document.querySelector('[data-part="echo"]')!.getAttribute("lang");
    expect(lang).toBe(
      new Intl.Locale(new Intl.DateTimeFormat("zz-ZZ").resolvedOptions().locale)
        .baseName,
    );
  });
});

describe("only the first letter is upper-cased (BH-036)", () => {
  it("the Spanish echo keeps its lower-case words", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 5, 17)}
        onChange={() => {}}
        placeholder="p"
        locale="es-ES"
      />,
    );
    expect(document.querySelector('[data-part="echo"]')!.textContent).toBe(
      "Miércoles, 17 de junio de 2026",
    );
  });

  it("month names in the pill and the months view start upper-case", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 5, 17)}
        onChange={() => {}}
        placeholder="p"
        locale="fr"
      />,
    );
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    const pill = screen.getByRole("dialog").querySelector('[data-part="month-pill"]')!;
    expect(pill.textContent).toMatch(/^Juin/);
  });
});
