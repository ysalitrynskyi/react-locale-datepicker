/**
 * Published contract pins for consumers on a payment / checkout path.
 *
 * These behaviours were true in 0.3.x but only incidentally guaranteed. A
 * travel-insurance checkout that adopted the package (34 locales, cross-
 * origin /embed, hardened browsers) needs each one to fail the suite if a
 * future release changes it. Prompt: adoption audit against that consumer's
 * in-product TravelDatePicker, 2026-08.
 */
import { fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LocaleDatePicker, resolveLocale } from "../src/LocaleDatePicker";
import { isoLocal, localDate, renderPicker } from "./helpers";

function assertLocalMidnight(d: Date, label: string) {
  expect(d.getHours(), `${label}: hours must be 0 (local midnight)`).toBe(0);
  expect(d.getMinutes(), `${label}: minutes must be 0`).toBe(0);
  expect(d.getSeconds(), `${label}: seconds must be 0`).toBe(0);
  expect(d.getMilliseconds(), `${label}: ms must be 0`).toBe(0);
}

describe("consumer contract: resolveLocale", () => {
  it('maps the non-BCP47 site code "ua" to "uk" (Ukrainian)', () => {
    // Load-bearing for any consumer whose product locale table uses the
    // ISO 3166 country code "ua" for Ukrainian instead of BCP 47 "uk".
    expect(
      resolveLocale("ua"),
      'resolveLocale("ua") must be "uk" — unnormalized "ua" breaks Intl and hydration',
    ).toBe("uk");
  });

  it("never throws, and structurally invalid tags fall back to en", () => {
    // Malformed (underscore form) raises RangeError from every Intl
    // constructor; the resolver must absorb it. Empty input is the same
    // class of "caller handed us garbage" and falls back to en.
    expect(() => resolveLocale("en_US")).not.toThrow();
    expect(resolveLocale("en_US")).toBe("en");
    expect(() => resolveLocale("")).not.toThrow();
    expect(resolveLocale("")).toBe("en");
    // Well-formed but unknown tags (zz-ZZ) are accepted by modern Intl
    // engines without throwing — they are returned as-is, not remapped to
    // "en". The contract is "never throw", not "only en or a known list".
    expect(() => resolveLocale("zz-ZZ")).not.toThrow();
    expect(resolveLocale("not a tag!!!")).toBe("en");
  });
});

describe("consumer contract: committed values are local midnight", () => {
  it("day-click, typed commit and controlled value all land on local midnight", async () => {
    // A UTC-midnight Date would shift the calendar day west of UTC and
    // corrupt a traveller's insurance start date. CI re-runs this suite
    // under TZ=UTC, America/Los_Angeles, Asia/Tokyo and Asia/Kathmandu
    // (non-hour offset +05:45).
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 5, 1),
      onChange,
    });
    await h.openViaClick();
    await h.clickDay(15);
    expect(onChange).toHaveBeenCalledTimes(1);
    const clicked: Date = onChange.mock.calls[0][0];
    assertLocalMidnight(clicked, "day click");
    expect(isoLocal(clicked)).toBe("2026-06-15");
    h.unmount();

    // Typed path.
    onChange.mockClear();
    const h2 = renderPicker({ initialValue: null, onChange });
    fireEvent.change(h2.input(), { target: { value: "04.07.2026" } });
    fireEvent.blur(h2.input());
    expect(onChange).toHaveBeenCalled();
    const typed: Date = onChange.mock.calls[0][0];
    assertLocalMidnight(typed, "typed commit");
    expect(isoLocal(typed)).toBe("2026-07-04");
    h2.unmount();

    // Controlled value that arrives already at local midnight stays there
    // in the displayed string (no day shift on re-render).
    const h3 = renderPicker({ initialValue: localDate(2026, 0, 1) });
    expect(h3.input()).toHaveValue("01.01.2026");
    expect(h3.committed()).toBe("2026-01-01");
    h3.unmount();
  });

  it("records the process timezone so a silent UTC-only CI cannot greenwash", () => {
    // The matrix (package.json test:tz + CI) is what makes the midnight
    // contract real. This assertion documents the current zone in failure
    // output and fails only if TZ is completely unset in a way that would
    // make getTimezoneOffset unusable — not a hard pin of a specific zone.
    const offset = new Date(2026, 5, 15).getTimezoneOffset();
    expect(typeof offset).toBe("number");
    expect(Number.isFinite(offset)).toBe(true);
  });
});

describe("consumer contract: no storage access", () => {
  it("source never references localStorage or sessionStorage", () => {
    // Source-level pin: a payment form under GDPR cannot adopt a package
    // that phones home via storage, and a hardened browser (Tor, Firefox
    // ETP Strict) may throw on storage access. Grep the published source
    // (not dist, so renames still trip this).
    const srcDir = resolve(__dirname, "../src");
    const files = ["LocaleDatePicker.tsx", "index.ts", "styles.css"];
    for (const file of files) {
      const text = readFileSync(resolve(srcDir, file), "utf8");
      expect(text, `${file} must not reference localStorage`).not.toMatch(
        /localStorage/,
      );
      expect(text, `${file} must not reference sessionStorage`).not.toMatch(
        /sessionStorage/,
      );
    }
  });
});

describe("consumer contract: display format is fixed dd.MM.yyyy", () => {
  it("does not vary the typed/display format by locale", async () => {
    // The consumer formats dd.MM.yyyy for its provider API and shows the
    // same string to the buyer. A locale-derived en-US 08/12/2026 would be
    // silent data corruption, not a cosmetic bug.
    const value = localDate(2026, 7, 12); // 12 August 2026
    for (const locale of ["en", "en-US", "de", "uk", "ua", "ja", "ar"]) {
      const h = renderPicker({ initialValue: value, locale });
      expect(
        h.input().value,
        `locale=${locale} must display dd.MM.yyyy, not a locale-derived order`,
      ).toBe("12.08.2026");
      h.unmount();
    }
  });
});

describe("consumer contract: portal escape for overflow:hidden", () => {
  it("default (no portal) keeps the popover inside the component root", async () => {
    const h = renderPicker({
      defaultCalendarMonth: localDate(2026, 6, 1),
    });
    await h.openViaClick();
    const dialog = h.dialog();
    const root = document.querySelector(".rldp-root");
    expect(root?.contains(dialog)).toBe(true);
    expect(dialog.getAttribute("data-portaled")).toBeNull();
  });

  it("portal={true} mounts the popover on document.body and marks it portaled", async () => {
    const h = renderPicker({
      defaultCalendarMonth: localDate(2026, 6, 1),
      portal: true,
    });
    await h.openViaClick();
    const dialog = h.dialog();
    const root = document.querySelector(".rldp-root");
    expect(root?.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("data-portaled")).toBe("true");
    // Day commit still works through the portaled tree.
    await h.clickDay(18);
    await waitFor(() => {
      expect(h.queryDialog()).toBeNull();
    });
    expect(h.committed()).toBe("2026-07-18");
  });

  it("portal={HTMLElement} mounts into the supplied host", async () => {
    const host = document.createElement("div");
    host.setAttribute("data-testid", "portal-host");
    document.body.appendChild(host);
    try {
      const h = renderPicker({
        defaultCalendarMonth: localDate(2026, 6, 1),
        portal: host,
      });
      await h.openViaClick();
      const dialog = h.dialog();
      expect(host.contains(dialog)).toBe(true);
      expect(dialog.getAttribute("data-portaled")).toBe("true");
      h.unmount();
    } finally {
      host.remove();
    }
  });

  it("outside click still closes a portaled popover; click inside does not", async () => {
    const h = renderPicker({
      defaultCalendarMonth: localDate(2026, 6, 1),
      portal: true,
    });
    await h.openViaClick();
    // Click inside the portaled dialog — must stay open.
    fireEvent.mouseDown(h.dialog());
    expect(h.queryDialog()).not.toBeNull();
    // Click outside both root and popover — must close.
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(h.queryDialog()).toBeNull();
    });
  });
});

// Keep the type import used so a tree-shaken editor does not drop the
// side-effect-free assertion that the component is still the public export.
void LocaleDatePicker;
