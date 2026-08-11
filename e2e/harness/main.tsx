import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LocaleDatePicker, type ThemeName } from "../../src/LocaleDatePicker";
import "../../src/styles.css";

type HarnessConfig = {
  locale: string;
  dir: "ltr" | "rtl" | "auto";
  disabled: boolean;
  hasError: boolean;
  valueIso: string | null;
  minIso: string | null;
  maxIso: string | null;
  defaultMonthIso: string | null;
  disableWeekends: boolean;
  placeholder: string;
  ariaLabel: string;
  themeName: ThemeName | undefined;
  /** Wraps the picker in an element carrying data-rldp-theme, for testing
   *  that themes apply from an ancestor and that nesting resolves to the
   *  nearest one. */
  ancestorTheme: string | null;
  /** Wraps the picker in an element setting --rldp-accent, for the 0.1.0
   *  regression where ancestor token overrides were silently ignored. */
  ancestorAccent: string | null;
  showEcho: boolean;
  showWeekdayHeader: boolean;
  showTodayMarker: boolean;
  /** Wrap the picker in a short overflow:hidden card — reproduces the
   *  checkout-form card shell that clips an in-tree absolute popover. */
  overflowHidden: boolean;
  /** Opt into the portal escape (`portal={true}` on the component). */
  portal: boolean;
};

function parseIsoLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoLocal(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readConfig(): HarnessConfig {
  const params = new URLSearchParams(window.location.search);
  return {
    locale: params.get("locale") ?? "en",
    dir: (params.get("dir") as HarnessConfig["dir"]) ?? "auto",
    disabled: params.get("disabled") === "1",
    hasError: params.get("hasError") === "1",
    valueIso: params.get("value"),
    minIso: params.get("min"),
    maxIso: params.get("max"),
    defaultMonthIso: params.get("defaultMonth"),
    disableWeekends: params.get("disableWeekends") === "1",
    placeholder: params.get("placeholder") ?? "dd.mm.yyyy",
    ariaLabel: params.get("ariaLabel") ?? "Pick a date",
    themeName: (params.get("themeName") as ThemeName | null) ?? undefined,
    ancestorTheme: params.get("ancestorTheme"),
    ancestorAccent: params.get("ancestorAccent"),
    showEcho: params.get("showEcho") !== "0",
    showWeekdayHeader: params.get("showWeekdayHeader") !== "0",
    showTodayMarker: params.get("showTodayMarker") !== "0",
    overflowHidden: params.get("overflowHidden") === "1",
    portal: params.get("portal") === "1",
  };
}

function App() {
  const cfg = useMemo(() => readConfig(), []);
  const [value, setValue] = useState<Date | null>(() =>
    parseIsoLocal(cfg.valueIso),
  );
  const [lastBlur, setLastBlur] = useState<string | null>(null);
  const [disabledAttempts, setDisabledAttempts] = useState(0);

  const dir =
    cfg.dir === "auto"
      ? ["ar", "he", "fa", "ur"].some(
          (t) => cfg.locale === t || cfg.locale.startsWith(`${t}-`),
        )
        ? "rtl"
        : "ltr"
      : cfg.dir;

  const shouldDisableDate = cfg.disableWeekends
    ? (d: Date) => d.getDay() === 0 || d.getDay() === 6
    : undefined;

  // Optional wrappers, so a test can put the theme or a raw token override
  // on an ANCESTOR rather than on the picker itself.
  const wrap = (node: React.ReactNode) => {
    let out = node;
    if (cfg.ancestorAccent) {
      out = (
        <div
          data-testid="accent-wrapper"
          style={{ ["--rldp-accent" as string]: cfg.ancestorAccent }}
        >
          {out}
        </div>
      );
    }
    if (cfg.ancestorTheme) {
      out = (
        <div data-testid="theme-wrapper" data-rldp-theme={cfg.ancestorTheme}>
          {out}
        </div>
      );
    }
    if (cfg.overflowHidden) {
      // Short card with overflow:hidden — the form-card shape that clips an
      // in-tree absolute popover. Height is deliberately smaller than the
      // calendar so the clip is unambiguous when portal is off.
      out = (
        <div
          data-testid="overflow-card"
          style={{
            width: 360,
            height: 72,
            overflow: "hidden",
            border: "2px solid #2563eb",
            borderRadius: 16,
            padding: 8,
            background: "#dbeafe",
            position: "relative",
          }}
        >
          {out}
        </div>
      );
    }
    return out;
  };

  return (
    <div dir={dir} data-testid="harness-root">
      <h1>LocaleDatePicker harness</h1>
      {wrap(
        <LocaleDatePicker
          value={value}
          onChange={setValue}
          locale={cfg.locale}
          placeholder={cfg.placeholder}
          disabled={cfg.disabled}
          hasError={cfg.hasError}
          minDate={parseIsoLocal(cfg.minIso)}
          maxDate={parseIsoLocal(cfg.maxIso)}
          defaultCalendarMonth={parseIsoLocal(cfg.defaultMonthIso)}
          shouldDisableDate={shouldDisableDate}
          aria-label={cfg.ariaLabel}
          themeName={cfg.themeName}
          showEcho={cfg.showEcho}
          showWeekdayHeader={cfg.showWeekdayHeader}
          showTodayMarker={cfg.showTodayMarker}
          portal={cfg.portal}
          onBlur={(current) => setLastBlur(toIsoLocal(current))}
          onDisabledOpenAttempt={() => setDisabledAttempts((n) => n + 1)}
        />,
      )}
      <pre data-testid="committed-iso">{toIsoLocal(value) ?? ""}</pre>
      <pre data-testid="blur-iso">{lastBlur ?? ""}</pre>
      <pre data-testid="disabled-attempts">{String(disabledAttempts)}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
