import { useMemo, useState } from "react";
// Imported by NAME, from the built package — never from ../../src. The point
// of the demo is to exercise the same entry points and exports map a real
// consumer resolves; a source deep-import would prove nothing about the
// thing that actually ships.
import {
  LocaleDatePicker,
  resolveLocale,
  todayInTimeZone,
  type ThemeName,
  type ValidationErrorReason,
} from "react-locale-datepicker";
import "react-locale-datepicker/styles.css";

/** Locales chosen to cover the scripts the component is validated against. */
const LOCALES = [
  { tag: "en-US", label: "English (US) — Sunday week start" },
  { tag: "en-GB", label: "English (UK)" },
  { tag: "de", label: "Deutsch" },
  { tag: "uk", label: "Українська" },
  { tag: "ua", label: "ua — non-standard alias, normalized to uk" },
  { tag: "ja", label: "日本語" },
  { tag: "ar", label: "العربية — right to left" },
  { tag: "he", label: "עברית — right to left" },
  { tag: "th", label: "ไทย" },
  { tag: "hi", label: "हिन्दी" },
  { tag: "zz-ZZ", label: "zz-ZZ — unknown tag, falls back safely" },
] as const;

const THEMES: ThemeName[] = ["default", "minimal", "soft", "high-contrast"];
const SCHEMES = ["auto", "light", "dark"] as const;

const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];
const isRtl = (tag: string) =>
  RTL_LANGUAGES.some((l) => tag === l || tag.startsWith(`${l}-`));

const iso = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`
    : "null";

function Example({
  title,
  note,
  children,
  value,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
  value: Date | null;
}) {
  return (
    <section className="example">
      <h2>{title}</h2>
      <p className="note">{note}</p>
      {children}
      <output className="value">
        onChange value: <code>{iso(value)}</code>
      </output>
    </section>
  );
}

export function App() {
  const [locale, setLocale] = useState<string>("en-US");
  const [themeName, setThemeName] = useState<ThemeName>("default");
  const [scheme, setScheme] = useState<(typeof SCHEMES)[number]>("auto");

  const [basic, setBasic] = useState<Date | null>(null);
  const [restricted, setRestricted] = useState<Date | null>(null);
  const [bare, setBare] = useState<Date | null>(null);
  const [shipped, setShipped] = useState<Date | null>(null);
  // The seller's calendar day, not the visitor's: Kiritimati is UTC+14, the
  // earliest timezone on Earth, so for most visitors "today" there is
  // already tomorrow. Same-day rules anchored to it demonstrate the gap.
  const BUSINESS_ZONE = "Pacific/Kiritimati";
  const businessToday = todayInTimeZone(BUSINESS_ZONE);
  const [lastError, setLastError] = useState<ValidationErrorReason | null>(
    null,
  );

  const dir = isRtl(locale) ? "rtl" : "ltr";

  // Weekends, plus a blackout week, to show that shouldDisableDate handles
  // scattered sets a min/max range cannot express.
  const blackoutStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const blackoutEnd = useMemo(() => {
    const d = new Date(blackoutStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [blackoutStart]);

  const shouldDisableDate = (d: Date) => {
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const blackout = d >= blackoutStart && d <= blackoutEnd;
    return weekend || blackout;
  };

  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 6, 0);

  return (
    // The scheme toggle sets the attribute the stylesheet already honours —
    // the package ships no theme-detection JavaScript, apps own the toggle.
    <div
      className="page"
      data-theme={scheme === "auto" ? undefined : scheme}
      dir={dir}
    >
      <header className="header">
        <h1>react-locale-datepicker</h1>
        <p className="tagline">
          A React date picker that localizes itself from the <code>Intl</code>{" "}
          API. Every locale, no locale files, RTL-aware, zero runtime
          dependencies.
        </p>
        <p className="links">
          <a href="https://www.npmjs.com/package/react-locale-datepicker">
            npm
          </a>
          {" · "}
          <a href="https://github.com/ysalitrynskyi/react-locale-datepicker">
            GitHub
          </a>
        </p>
      </header>

      <div className="controls" dir="ltr">
        <label>
          <span>Locale</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            aria-label="Locale"
          >
            {LOCALES.map((l) => (
              <option key={l.tag} value={l.tag}>
                {l.tag} — {l.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Theme</span>
          <select
            value={themeName}
            onChange={(e) => setThemeName(e.target.value as ThemeName)}
            aria-label="Theme"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Colour scheme</span>
          <select
            value={scheme}
            onChange={(e) =>
              setScheme(e.target.value as (typeof SCHEMES)[number])
            }
            aria-label="Colour scheme"
          >
            {SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s === "auto" ? "auto (follows your OS)" : s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="resolved" dir="ltr">
        <code>resolveLocale({JSON.stringify(locale)})</code> →{" "}
        <code>{JSON.stringify(resolveLocale(locale))}</code>
        {" · direction "}
        <code>{dir}</code>
      </p>

      <main className="examples">
        <Example
          title="Basic"
          note="Month names, weekday names, the first day of the week and the long-form echo all come from Intl. Type digits and they mask into the format; localized digits normalize to ASCII."
          value={basic}
        >
          <LocaleDatePicker
            value={basic}
            onChange={setBasic}
            locale={locale}
            themeName={themeName}
            placeholder="dd.mm.yyyy"
            aria-label="Basic example"
            onValidationError={setLastError}
          />
          <p className="hint">
            Last typed-input report:{" "}
            <code>{lastError ?? "none"}</code>
          </p>
        </Example>

        <Example
          title="Disabled days"
          note="Weekends plus a blackout week, through shouldDisableDate — the single authority on selectability. minDate and maxDate bound navigation only, and never override it."
          value={restricted}
        >
          <LocaleDatePicker
            value={restricted}
            onChange={setRestricted}
            locale={locale}
            themeName={themeName}
            placeholder="dd.mm.yyyy"
            aria-label="Disabled days example"
            shouldDisableDate={shouldDisableDate}
            minDate={minDate}
            maxDate={maxDate}
          />
        </Example>

        <Example
          title="Opt-outs"
          note="Every built-in can be turned off, with today's behaviour as the default: here the echo, the weekday header and the today marker are all disabled."
          value={bare}
        >
          <LocaleDatePicker
            value={bare}
            onChange={setBare}
            locale={locale}
            themeName={themeName}
            placeholder="dd.mm.yyyy"
            aria-label="Opt-outs example"
            showEcho={false}
            showWeekdayHeader={false}
            showTodayMarker={false}
          />
        </Example>

        <Example
          title="Business timezone"
          note='"Today" (the ring and the default view) is derived in Pacific/Kiritimati, UTC+14 — the seller&apos;s calendar day — and days before it are disabled via todayInTimeZone, so the marker and the rules agree even when the visitor is a day behind. Values stay local-midnight Dates.'
          value={shipped}
        >
          <LocaleDatePicker
            value={shipped}
            onChange={setShipped}
            locale={locale}
            themeName={themeName}
            placeholder="dd.mm.yyyy"
            aria-label="Business timezone example"
            timeZone={BUSINESS_ZONE}
            shouldDisableDate={(d) => d < businessToday}
          />
          <p className="hint">
            Business today: <code>{iso(businessToday)}</code> · your local
            today: <code>{iso(new Date())}</code>
          </p>
        </Example>
      </main>

      <footer className="footer">
        <p>
          Keyboard: arrows move by day and week, PageUp/PageDown by month,
          Shift+PageUp/PageDown by year, Home/End to the week bounds, Enter or
          Space to commit, Escape to dismiss. ArrowDown from the field opens
          the calendar, then moves into the grid.
        </p>
        <p>MIT licensed.</p>
      </footer>
    </div>
  );
}
