import React from "react";

// Lightweight locale-aware date picker, extracted from a production form.
// Design rationale carried over from the third-party picker it replaced:
// - one-tap selection: clicking a day commits and closes (the previous
//   picker required an extra confirm press);
// - month/year navigation is two explicit dropdown-styled grids instead of
//   one long scrolling year-month list;
// - month, weekday, and full-date names come from Intl.DateTimeFormat, so
//   the calendar is localized for every locale without translation keys
//   (the previous picker rendered English month names for every non-English
//   locale);
// - no third-party stylesheet lands on the consumer's critical path.
//
// Behavioural contract (full parity list in docs/EXTRACTION.md):
// - value/onChange use local-midnight Date objects. Consumers read
//   getDate/getMonth/getFullYear, so the Date must stay timezone-local —
//   no UTC parsing, no toISOString round trip;
// - shouldDisableDate remains the single authority for selectable days;
// - typing stays possible: digits are auto-masked into dd.MM.yyyy (an iOS
//   numeric keypad has no separator keys), Eastern Arabic-Indic digits are
//   normalized, and the committed date is echoed under the field in words
//   via Intl so a US-style month/day mix-up is immediately visible;
// - accepts aria-label / aria-invalid / aria-describedby / onBlur props
//   with exactly this spelling — regression tests in the source product
//   assert on it. onBlur receives the just-committed value: validating
//   parent state in the same tick reads the pre-commit closure and flashes
//   a false "required" error.

export interface LocaleDatePickerProps {
  /** Local-midnight Date, or null when empty. Consumers read
   *  getDate/getMonth/getFullYear and expect the day the user clicked —
   *  see the timezone contract in docs/API.md. */
  value: Date | null;
  /** Fires on commit (day click, Enter, or a blur that accepts a typed
   *  date), not on every keystroke. */
  onChange: (date: Date | null) => void;
  /** The single authority on selectable days. minDate/maxDate bound
   *  navigation only and never override this predicate. Defaults to every
   *  day selectable. */
  shouldDisableDate?: (date: Date) => boolean;
  /** Any BCP 47 tag Intl accepts. Non-standard aliases are normalized by
   *  resolveLocale before reaching Intl — see that function. */
  locale?: string;
  /** Not derived from the locale: the display format is fixed, so the hint
   *  must be caller-controlled too. */
  placeholder: string;
  disabled?: boolean;
  /** Visual only. The component never decides validity. */
  hasError?: boolean;
  /** Month shown when opening with no value (e.g. the month of a related
   *  field's value). Falls back to today / first enabled month. */
  defaultCalendarMonth?: Date | null;
  /** Limits month/year navigation and the year grid. Day-level selection is
   *  still governed by shouldDisableDate. */
  minDate?: Date | null;
  maxDate?: Date | null;
  /** Called with the field's current committed value after a blur commit —
   *  never validate captured parent state instead of this argument. */
  onBlur?: (current: Date | null) => void;
  /** Fired when the user tries to open the picker while it is disabled
   *  (e.g. while a prerequisite field is still empty) so the form can guide
   *  the user to the field they must fill first. */
  onDisabledOpenAttempt?: () => void;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

// Some applications use locale codes that are not valid BCP 47 language
// subtags. The known case is Ukrainian written as "ua" (a country code)
// where Intl expects "uk": passing raw "ua" through resolves differently
// between Node (SSR) and browsers, which in the source product crashed
// hydration of the entire form island around the picker, not just the
// picker itself. Exported so consumers can resolve their own Intl calls
// identically.
//
// Anything Intl still rejects — a structurally malformed tag such as
// "en_US" raises a RangeError from every Intl constructor — falls back to
// "en" instead of throwing. No caller-supplied locale string may reach Intl
// unnormalized, including in any code added later.
const LOCALE_ALIASES: Record<string, string> = { ua: "uk" };
// Cache keyed by the raw input: validation constructs an Intl.DateTimeFormat,
// which is far more expensive than the plain object lookup this replaced,
// and the component calls resolveLocale on every render.
const resolveCache = new Map<string, string>();
export const resolveLocale = (locale: string): string => {
  const cached = resolveCache.get(locale);
  if (cached !== undefined) return cached;
  const candidate = LOCALE_ALIASES[locale] || locale || "en";
  let resolved: string;
  try {
    new Intl.DateTimeFormat(candidate);
    resolved = candidate;
  } catch {
    resolved = "en";
  }
  resolveCache.set(locale, resolved);
  return resolved;
};

// Inline SVGs instead of an icon-library dependency (docs/DECISIONS.md D4).
// Conventional 24px calendar/chevron geometry, stroked with currentColor so
// they follow the surrounding text colour. The width/height attributes are
// the no-stylesheet fallback: the sizing classes win when the utility CSS
// is present, but a viewBox-only SVG with no CSS renders at the replaced-
// element default of 300x150 instead of 24x24.
const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x={3} y={5} width={18} height={16} rx={2} />
    <path d="M8 3v4M16 3v4M3 9h18" />
  </svg>
);
const ChevronLeft: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const ChevronDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// useLayoutEffect warns during SSR; the popup only exists client-side.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// First day of week as a JS day index (0=Sun..6=Sat). Uses Intl weekInfo
// where available (Chrome/Safari property, Firefox method), else Monday —
// the majority convention among the locales this component was validated
// against in production.
function firstDayOfWeek(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info =
      typeof l.getWeekInfo === "function" ? l.getWeekInfo() : l.weekInfo;
    if (info && typeof info.firstDay === "number") {
      return info.firstDay % 7; // Intl: 1=Mon..7=Sun → JS: 0=Sun..6=Sat
    }
  } catch {
    /* older engines: fall through */
  }
  return 1;
}

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "Today" for the today ring, the default keyboard target, and the default
// year range — derived in local time, matching the local-midnight Dates the
// component emits. Known limitation, recorded from a real bug: when a
// consumer's shouldDisableDate rules run in one fixed timezone, a marker
// derived in the user's own timezone can ring an already-disabled
// neighbouring day near midnight. The source of this component fixed that
// by computing "today" in the timezone its rules ran in; a generic
// component cannot know the consumer's rule timezone, so the mismatch is
// cosmetic-possible here (selection stays governed solely by
// shouldDisableDate). Restoring the guarantee needs a today/timeZone prop —
// record a decision in docs/DECISIONS.md before adding that API.
const localToday = (): Date => startOfDay(new Date());
const sameDay = (a: Date | null, b: Date | null): boolean =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const monthKey = (d: Date): number => d.getFullYear() * 12 + d.getMonth();
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Default predicate: every day selectable. Module-level so the reference is
// stable across renders.
const noDayDisabled = (): boolean => false;

const formatDisplay = (date: Date | null): string => {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
};

// Normalize Eastern Arabic-Indic (٠-٩) and Extended (۰-۹) digits, drop
// everything but digits, and re-mask as dd.MM.yyyy while typing. The mask
// means the iOS numeric keypad (which has no "." key) can still type dates.
const maskTyped = (raw: string): string => {
  const digits = raw
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

// Accepts dd.MM.yyyy with . / - separators and 1-digit day/month (pasted
// text can carry its own separators; masked input always matches).
const parseTyped = (raw: string): Date | null => {
  const m = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // e.g. 31.02.2026
  }
  return date;
};

export const LocaleDatePicker: React.FC<LocaleDatePickerProps> = ({
  value,
  onChange,
  shouldDisableDate = noDayDisabled,
  locale = "en",
  placeholder,
  disabled,
  hasError,
  defaultCalendarMonth,
  minDate,
  maxDate,
  onBlur,
  onDisabledOpenAttempt,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}) => {
  const resolvedLocale = resolveLocale(locale);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"days" | "months" | "years">("days");
  // First day of the month currently shown in the days grid.
  const [viewMonth, setViewMonth] = React.useState<Date>(() =>
    startOfDay(value || defaultCalendarMonth || new Date()),
  );
  // Text shown in the input while the user is typing; null = mirror value.
  const [draft, setDraft] = React.useState<string | null>(null);
  // Day that owns the roving tabindex inside the grid.
  const [focusDay, setFocusDay] = React.useState<Date | null>(null);
  // Measured after render: whether the popup flips above the field, and the
  // horizontal offset (px) that keeps it inside the viewport.
  const [pos, setPos] = React.useState<{ up: boolean; shift: number }>({
    up: false,
    shift: 0,
  });
  // DOM focus only follows focusDay after keyboard navigation — opening the
  // popup with the mouse must NOT steal focus from the text input.
  const keyboardNavRef = React.useRef(false);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const weekStart = React.useMemo(
    () => firstDayOfWeek(resolvedLocale),
    [resolvedLocale],
  );
  // calendar: "gregory" is pinned on every formatter so the long-form echo
  // and grid labels always describe the same Gregorian day the grid shows.
  // Without it, ar-SA defaults to islamic-umalqura and th-TH to the Buddhist
  // era, so a selection on the Gregorian grid echoed as a Hijri/Buddhist
  // date (docs/DECISIONS.md D11). Display calendars may become opt-in later;
  // the value type stays a Gregorian-interpreted local-midnight Date.
  const monthTitleFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale],
  );
  const monthLongFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        month: "long",
      }),
    [resolvedLocale],
  );
  const monthShortFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        month: "short",
      }),
    [resolvedLocale],
  );
  const weekdayFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        weekday: "short",
      }),
    [resolvedLocale],
  );
  const fullDateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale],
  );
  // Day-cell accessible names must BEGIN with the day number so voice-control
  // commands like "click 18" match. fullDateFmt leads with the weekday in
  // most locales, which breaks that match (ROADMAP Track 5 defect). Build the
  // name explicitly: number first, then weekday/month/year from Intl parts.
  const dayNamePartsFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        weekday: "long",
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale],
  );
  const formatDayAccessibleName = React.useCallback(
    (d: Date): string => {
      const parts = dayNamePartsFmt.formatToParts(d);
      const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
      const month = parts.find((p) => p.type === "month")?.value ?? "";
      const year = parts.find((p) => p.type === "year")?.value ?? "";
      return `${d.getDate()} ${weekday} ${month} ${year}`
        .replace(/\s+/g, " ")
        .trim();
    },
    [dayNamePartsFmt],
  );

  const minMonth = minDate ? monthKey(minDate) : null;
  const maxMonth = maxDate ? monthKey(maxDate) : null;
  const clampMonth = React.useCallback(
    (d: Date): Date => {
      const k = monthKey(d);
      if (minMonth !== null && k < minMonth)
        return new Date(minDate!.getFullYear(), minDate!.getMonth(), 1);
      if (maxMonth !== null && k > maxMonth)
        return new Date(maxDate!.getFullYear(), maxDate!.getMonth(), 1);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    },
    [minMonth, maxMonth, minDate, maxDate],
  );

  const openPopup = () => {
    if (disabled) {
      onDisabledOpenAttempt?.();
      return;
    }
    const base = value || defaultCalendarMonth || localToday();
    setViewMonth(clampMonth(startOfDay(base)));
    setFocusDay(value ? startOfDay(value) : null);
    setView("days");
    keyboardNavRef.current = false;
    setOpen(true);
  };

  const close = React.useCallback((refocus = false) => {
    setOpen(false);
    setView("days");
    keyboardNavRef.current = false;
    if (refocus) inputRef.current?.focus();
  }, []);

  // Outside interaction closes the popup. `mousedown` (not click) so the
  // popup is gone before any other control processes the press.
  React.useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t)) close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [open, close]);

  // Escape must close no matter where focus sits. Safari does not focus
  // buttons on click, so after tapping a calendar control the keydown fires
  // on <body> and an element-level handler would never see it.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Position the popup from its real rendered size: flip above the field
  // when the space below is too small, and shift horizontally so it never
  // leaves the viewport (the field can sit near the viewport edge on 320px
  // screens). Re-measured when the view changes — the month/year grids are
  // shorter than the days grid.
  useIsoLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const pop = popupRef.current;
    if (!root || !pop) return;
    const r = root.getBoundingClientRect();
    const ph = pop.offsetHeight;
    const pw = pop.offsetWidth;
    const spaceBelow = window.innerHeight - r.bottom;
    // When neither side fits fully, open toward the roomier side; the page
    // can scroll to reveal the rest.
    const up = spaceBelow < ph + 8 && r.top > spaceBelow;
    let shift = 0;
    const maxLeft = window.innerWidth - 8 - pw;
    if (r.left > maxLeft) shift = maxLeft - r.left;
    if (r.left + shift < 8) shift = 8 - r.left;
    setPos((p) => (p.up === up && p.shift === shift ? p : { up, shift }));
    // Nudge the page so the whole calendar is on screen (no-op when it is).
    requestAnimationFrame(() => {
      popupRef.current?.scrollIntoView({ block: "nearest" });
    });
  }, [open, view, viewMonth]);

  const commit = (date: Date) => {
    onChange(startOfDay(date));
    setDraft(null);
    // Swallow clicks for a beat after the popup unmounts: the second click
    // of an accidental double-click on a day would otherwise land on
    // whatever control renders underneath the closed popup and silently
    // change it.
    if (typeof document !== "undefined") {
      const guard = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener("click", guard, true);
      window.setTimeout(() => {
        // Guard: jsdom tests may tear down the document before this fires;
        // browsers always have document here.
        if (typeof document === "undefined") return;
        document.removeEventListener("click", guard, true);
      }, 350);
    }
    close(true);
  };

  // Returns the newly committed Date, or undefined when nothing changed —
  // the blur handler forwards the effective value to the parent.
  const commitTyped = (): Date | undefined => {
    if (draft === null) return undefined;
    if (draft.trim() === "") {
      // Field cleared by typing: keep the previous committed value and just
      // resync the text. Typing never commits null — a parent that supports
      // clearing does it from outside through value/onChange.
      setDraft(null);
      return undefined;
    }
    const parsed = parseTyped(draft);
    setDraft(null); // invalid input reverts to the committed value
    if (parsed && !shouldDisableDate(parsed)) {
      const d = startOfDay(parsed);
      onChange(d);
      return d;
    }
    return undefined;
  };

  // --- Days grid model -----------------------------------------------------
  const daysGrid = React.useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    ).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth, weekStart]);

  const weekdayLabels = React.useMemo(() => {
    // 2024-06-02 was a Sunday; offset from it to label each column.
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(2024, 5, 2 + ((weekStart + i) % 7));
      labels.push(weekdayFmt.format(day));
    }
    return labels;
  }, [weekStart, weekdayFmt]);

  const today = localToday();

  // The one grid cell holding tabindex=0. Chain: keyboard cursor → selected
  // value → today → first enabled day of the visible month. Without the
  // final fallback the grid has no tab stop at all whenever nothing is
  // selected and today is disabled — routine for pickers whose rules
  // disable today and everything before it — making keyboard selection
  // impossible.
  const roveTarget = React.useMemo(() => {
    const inView = (d: Date | null) =>
      !!d && monthKey(d) === monthKey(viewMonth);
    if (inView(focusDay)) return focusDay!;
    if (inView(value)) return startOfDay(value!);
    if (inView(today) && !shouldDisableDate(today)) return today;
    for (const d of daysGrid) {
      if (d && !shouldDisableDate(d)) return d;
    }
    return null;
    // shouldDisableDate and today are intentionally omitted: the roving
    // target only needs to recompute when the grid or selection moves; the
    // predicate is stable for a given open session in practice.
  }, [focusDay, value, viewMonth, daysGrid]);

  const canPrevMonth = minMonth === null || monthKey(viewMonth) > minMonth;
  const canNextMonth = maxMonth === null || monthKey(viewMonth) < maxMonth;

  const shiftMonth = (delta: number) => {
    setViewMonth((m) =>
      clampMonth(new Date(m.getFullYear(), m.getMonth() + delta, 1)),
    );
  };

  const isRTL = () =>
    typeof document !== "undefined" &&
    (rootRef.current?.closest("[dir]") as HTMLElement | null)?.dir === "rtl";

  const focusGridDay = (d: Date) => {
    keyboardNavRef.current = true;
    setFocusDay(d);
    // Focus directly when the cell is already rendered; the effect below
    // covers cells in a month that must render first.
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-day="${dayKey(d)}"]`,
    );
    btn?.focus();
  };

  // Clamp day-of-month when stepping by month/year so 31 Jan + 1 month
  // lands on 28/29 Feb rather than overflowing into March.
  const addCalendarMonths = (d: Date, delta: number): Date => {
    const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
    const last = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();
    return new Date(
      target.getFullYear(),
      target.getMonth(),
      Math.min(d.getDate(), last),
    );
  };

  // Keyboard navigation inside the days grid. Disabled days stay focusable
  // (aria-disabled, not disabled) so the cursor can traverse them — a
  // native-disabled cell cannot receive focus and silently breaks roving.
  // Map matches the converged APG/Duet/Cally model: arrows, PageUp/PageDown
  // (month), Shift+PageUp/PageDown (year), Home/End (week bounds), Enter/
  // Space commit, Escape (document-level) dismiss.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (view !== "days") return;
    const base = focusDay || roveTarget || today;
    const horiz = isRTL() ? -1 : 1;
    let next: Date;
    switch (e.key) {
      case "ArrowLeft":
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - horiz,
        );
        break;
      case "ArrowRight":
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() + horiz,
        );
        break;
      case "ArrowUp":
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7);
        break;
      case "ArrowDown":
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
        break;
      case "PageUp":
        next = e.shiftKey
          ? addCalendarMonths(base, -12)
          : addCalendarMonths(base, -1);
        break;
      case "PageDown":
        next = e.shiftKey
          ? addCalendarMonths(base, 12)
          : addCalendarMonths(base, 1);
        break;
      case "Home": {
        // Start of the locale week containing `base`.
        const dist = (base.getDay() - weekStart + 7) % 7;
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - dist,
        );
        break;
      }
      case "End": {
        // End of the locale week containing `base`.
        const dist = (base.getDay() - weekStart + 7) % 7;
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() + (6 - dist),
        );
        break;
      }
      case "Enter":
      case " ":
        if (focusDay && !shouldDisableDate(focusDay)) {
          e.preventDefault();
          commit(focusDay);
        } else {
          e.preventDefault(); // disabled day: swallow, keep dialog open
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    const k = monthKey(next);
    if (minMonth !== null && k < minMonth) return;
    if (maxMonth !== null && k > maxMonth) return;
    keyboardNavRef.current = true;
    setFocusDay(next);
    if (k !== monthKey(viewMonth)) {
      setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  // Move DOM focus to the roving day button after KEYBOARD navigation only —
  // mouse-opening the popup must leave focus in the text input so the user
  // can keep typing (and screen readers stay on the labeled field).
  React.useEffect(() => {
    if (!open || view !== "days" || !focusDay || !keyboardNavRef.current)
      return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-day="${dayKey(focusDay)}"]`,
    );
    btn?.focus();
  }, [focusDay, open, view, viewMonth]);

  // --- Months / years grids ------------------------------------------------
  const yearNow = today.getFullYear();
  const yearsRange = React.useMemo(() => {
    const from = minDate ? minDate.getFullYear() : yearNow;
    const to = maxDate ? maxDate.getFullYear() : yearNow + 2;
    const years: number[] = [];
    for (let y = from; y <= to; y++) years.push(y);
    return years;
  }, [minDate, maxDate, yearNow]);
  const yearMin = yearsRange[0];
  const yearMax = yearsRange[yearsRange.length - 1];

  const monthEnabled = (year: number, month: number): boolean => {
    const k = year * 12 + month;
    if (minMonth !== null && k < minMonth) return false;
    if (maxMonth !== null && k > maxMonth) return false;
    return true;
  };

  const inputText = draft !== null ? draft : formatDisplay(value);
  const prevMonthDate = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() - 1,
    1,
  );
  const nextMonthDate = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    1,
  );

  // Header chevrons: in days view they step months; in months view they
  // step YEARS (clamped to the year range, labelled with the year).
  const headerPrev = () => {
    if (view === "months") {
      setViewMonth((m) =>
        clampMonth(new Date(m.getFullYear() - 1, m.getMonth(), 1)),
      );
    } else {
      shiftMonth(-1);
    }
  };
  const headerNext = () => {
    if (view === "months") {
      setViewMonth((m) =>
        clampMonth(new Date(m.getFullYear() + 1, m.getMonth(), 1)),
      );
    } else {
      shiftMonth(1);
    }
  };
  const headerPrevDisabled =
    view === "years" ||
    (view === "months"
      ? viewMonth.getFullYear() - 1 < yearMin
      : !canPrevMonth);
  const headerNextDisabled =
    view === "years" ||
    (view === "months"
      ? viewMonth.getFullYear() + 1 > yearMax
      : !canNextMonth);
  const headerPrevLabel =
    view === "months"
      ? String(viewMonth.getFullYear() - 1)
      : monthTitleFmt.format(prevMonthDate);
  const headerNextLabel =
    view === "months"
      ? String(viewMonth.getFullYear() + 1)
      : monthTitleFmt.format(nextMonthDate);

  const dayBtnBase =
    "h-11 md:h-9 w-full rounded-md text-sm flex items-center justify-center select-none transition-colors touch-manipulation";
  const navBtn =
    "h-11 w-11 md:h-9 md:w-9 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation";
  const pillBtn = (active: boolean) =>
    `flex items-center gap-1 rounded-md border px-2.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation ${
      active
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-gray-300 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-gray-100"
    }`;

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`flex w-full items-center rounded-md border-2 bg-white px-2 min-h-11 md:min-h-9 ${
          hasError ? "border-red-400" : "border-gray-200"
        } ${disabled ? "bg-gray-50 opacity-60" : "focus-within:border-blue-500"}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="w-full border-0 bg-transparent p-0 text-base md:text-sm text-gray-900 placeholder:text-gray-400 read-only:cursor-not-allowed focus:outline-none focus:ring-0 touch-manipulation"
          value={inputText}
          placeholder={placeholder}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => !open && openPopup()}
          onChange={(e) => {
            if (disabled) return;
            setDraft(maskTyped(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) {
                openPopup();
              } else if (roveTarget) {
                // Second ArrowDown moves the keyboard into the grid.
                focusGridDay(roveTarget);
              }
            }
          }}
          onBlur={() => {
            const committed = commitTyped();
            onBlur?.(committed !== undefined ? committed : value);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          className="ml-1 shrink-0 p-1 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed touch-manipulation"
          onMouseDown={(e) => {
            // Runs before the document mousedown-close listener would; toggle
            // without letting the input blur first.
            e.preventDefault();
            if (open) close();
            else openPopup();
          }}
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Committed date in words (localized). Month rendered as a WORD makes
          a day/month transposition while typing immediately visible, and
          doubles as confirmation that a typed edit was accepted. */}
      {value && (
        <p className="mt-0.5 text-xs text-gray-600 capitalize">
          {fullDateFmt.format(value)}
        </p>
      )}

      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label={ariaLabel}
          style={{ left: pos.shift }}
          // Keep focus in the input while clicking inside the popup: a
          // mousedown blur would run the parent's validation against a
          // still-empty field and flash a false error.
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName !== "INPUT") {
              e.preventDefault();
            }
          }}
          className={`absolute z-50 w-[19.5rem] max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-xl touch-manipulation ${
            pos.up ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              className={navBtn}
              disabled={headerPrevDisabled}
              aria-label={headerPrevLabel}
              onClick={headerPrev}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            {/* Month + year read as dropdown selects: bordered pill with a
                caret that flips while its grid is open. */}
            <div className="flex items-center gap-1.5">
              <span className="sr-only" aria-live="polite">
                {monthTitleFmt.format(viewMonth)}
              </span>
              <button
                type="button"
                className={`${pillBtn(view === "months")} capitalize`}
                aria-expanded={view === "months"}
                onClick={() => setView(view === "months" ? "days" : "months")}
              >
                {monthLongFmt.format(viewMonth)}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    view === "months"
                      ? "rotate-180 text-blue-600"
                      : "text-gray-500"
                  }`}
                />
              </button>
              <button
                type="button"
                className={pillBtn(view === "years")}
                aria-expanded={view === "years"}
                onClick={() => setView(view === "years" ? "days" : "years")}
              >
                {viewMonth.getFullYear()}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    view === "years"
                      ? "rotate-180 text-blue-600"
                      : "text-gray-500"
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              className={navBtn}
              disabled={headerNextDisabled}
              aria-label={headerNextLabel}
              onClick={headerNext}
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>

          {/* Days */}
          {view === "days" && (
            <div ref={gridRef} onKeyDown={onGridKeyDown}>
              <div className="grid grid-cols-7">
                {weekdayLabels.map((w, i) => (
                  <div
                    key={i}
                    className="flex h-8 items-center justify-center text-xs font-medium uppercase text-gray-500"
                    aria-hidden="true"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {daysGrid.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const isDisabled = shouldDisableDate(d);
                  const isSelected = sameDay(d, value);
                  const isToday = sameDay(d, today);
                  const isRove = roveTarget !== null && sameDay(d, roveTarget);
                  return (
                    <button
                      key={i}
                      type="button"
                      data-day={dayKey(d)}
                      // aria-disabled keeps the cell focusable so arrow-key
                      // traversal never dead-ends on a disabled date.
                      aria-disabled={isDisabled || undefined}
                      tabIndex={isRove ? 0 : -1}
                      aria-label={formatDayAccessibleName(d)}
                      aria-current={isSelected ? "date" : undefined}
                      className={`${dayBtnBase} ${
                        isSelected
                          ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                          : isDisabled
                            ? "cursor-not-allowed text-gray-400"
                            : "text-gray-800 hover:bg-blue-50"
                      } ${
                        isToday && !isSelected
                          ? "ring-1 ring-inset ring-blue-400"
                          : ""
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                      onClick={() => {
                        if (!isDisabled) commit(d);
                      }}
                      onFocus={() => setFocusDay(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Months */}
          {view === "months" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, m) => {
                const enabled = monthEnabled(viewMonth.getFullYear(), m);
                const isCurrent = m === viewMonth.getMonth();
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!enabled}
                    aria-label={monthLongFmt.format(
                      new Date(viewMonth.getFullYear(), m, 15),
                    )}
                    className={`h-11 rounded-md text-sm capitalize transition-colors touch-manipulation ${
                      isCurrent
                        ? "bg-blue-600 font-semibold text-white"
                        : enabled
                          ? "text-gray-800 hover:bg-blue-50"
                          : "cursor-not-allowed text-gray-400"
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                    onClick={() => {
                      setViewMonth(
                        clampMonth(new Date(viewMonth.getFullYear(), m, 1)),
                      );
                      setView("days");
                    }}
                  >
                    {monthShortFmt.format(
                      new Date(viewMonth.getFullYear(), m, 15),
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Years */}
          {view === "years" && (
            <div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto">
              {yearsRange.map((y) => {
                const isCurrent = y === viewMonth.getFullYear();
                return (
                  <button
                    key={y}
                    type="button"
                    className={`h-11 rounded-md text-sm transition-colors touch-manipulation ${
                      isCurrent
                        ? "bg-blue-600 font-semibold text-white"
                        : "text-gray-800 hover:bg-blue-50"
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                    onClick={() => {
                      setViewMonth(
                        clampMonth(new Date(y, viewMonth.getMonth(), 1)),
                      );
                      setView("months");
                    }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
