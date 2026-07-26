import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LocaleDatePicker } from "../../src/LocaleDatePicker";

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
      ? ["ar", "he", "fa", "ur"].some((t) =>
          cfg.locale === t || cfg.locale.startsWith(`${t}-`),
        )
        ? "rtl"
        : "ltr"
      : cfg.dir;

  const shouldDisableDate = cfg.disableWeekends
    ? (d: Date) => d.getDay() === 0 || d.getDay() === 6
    : undefined;

  return (
    <div dir={dir} data-testid="harness-root">
      <h1>LocaleDatePicker harness</h1>
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
        onBlur={(current) => setLastBlur(toIsoLocal(current))}
        onDisabledOpenAttempt={() => setDisabledAttempts((n) => n + 1)}
      />
      <pre data-testid="committed-iso">{toIsoLocal(value) ?? ""}</pre>
      <pre data-testid="blur-iso">{lastBlur ?? ""}</pre>
      <pre data-testid="disabled-attempts">{String(disabledAttempts)}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
