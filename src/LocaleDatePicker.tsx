import React from "react";
import { createPortal } from "react-dom";

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

// The published anatomy (decision D10). ONE canonical list drives three
// things that would otherwise drift apart: the data-part attribute stamped
// on every element the component renders, the classNames and styles keys,
// and docs/ANATOMY.md.
//
// data-part values are kebab-case because they get written into CSS
// selectors; slot keys are camelCase because they are JavaScript
// identifiers. State is carried by data attributes (data-selected,
// data-disabled, data-today, data-error, data-current, data-placement), so a
// consumer who discards the stylesheet entirely still has a complete,
// documented styling contract — that is the headless escape hatch.
//
// This list may grow. Entries are never removed or renamed: consumers write
// selectors against it.
export const ANATOMY = [
  { part: "root", slot: "root" },
  { part: "field", slot: "field" },
  { part: "input", slot: "input" },
  { part: "trigger", slot: "trigger" },
  { part: "trigger-icon", slot: "triggerIcon" },
  { part: "echo", slot: "echo" },
  { part: "popover", slot: "popover" },
  { part: "header", slot: "header" },
  { part: "nav-previous", slot: "navPrevious" },
  { part: "nav-next", slot: "navNext" },
  { part: "nav-icon", slot: "navIcon" },
  { part: "selects", slot: "selects" },
  { part: "live-region", slot: "liveRegion" },
  { part: "keyboard-help", slot: "keyboardHelp" },
  { part: "month-pill", slot: "monthPill" },
  { part: "year-pill", slot: "yearPill" },
  { part: "caret", slot: "caret" },
  { part: "grid", slot: "grid" },
  { part: "weekdays", slot: "weekdays" },
  { part: "weekday", slot: "weekday" },
  { part: "days", slot: "days" },
  { part: "week", slot: "week" },
  { part: "day-cell", slot: "dayCell" },
  { part: "day", slot: "day" },
  { part: "day-blank", slot: "dayBlank" },
  { part: "months", slot: "months" },
  { part: "month", slot: "month" },
  { part: "years", slot: "years" },
  { part: "year", slot: "year" },
] as const;

/** A `data-part` value. One per element the component renders. */
export type Part = (typeof ANATOMY)[number]["part"];

/** The anatomy half of {@link Slot} — one key per rendered element. */
export type PartSlot = (typeof ANATOMY)[number]["slot"];

// Styling slots overridable through the classNames and styles props
// (decisions D3 and D10). Custom classes are appended after the built-in
// rldp-* class so consumer rules of equal specificity win; the shipped
// stylesheet additionally keeps itself inside a cascade layer so consumer
// CSS always takes priority.
//
// Beyond one key per part, a few keys address a STATE of a part rather than
// an element of its own. They are additive to the 0.1.0 set, which is kept
// verbatim.
export type Slot =
  | PartSlot
  | "daySelected"
  | "dayDisabled"
  | "dayToday"
  | "monthCurrent"
  | "yearCurrent";

// Lookup built from the anatomy so the attribute and the override key can
// never disagree.
const SLOT_PART = Object.fromEntries(
  ANATOMY.map((entry) => [entry.slot, entry.part]),
) as Record<PartSlot, Part>;

// The four built-in glyphs, substitutable through the icons prop (D4).
export type IconName =
  "calendar" | "chevronLeft" | "chevronRight" | "chevronDown";

// Why a typed date was not committed. Follows GOV.UK's error taxonomy, and
// deliberately stops at three: the component classifies and REPORTS, the
// consumer decides what that means and renders it. hasError stays visual
// only and commitTyped still consults nothing but shouldDisableDate, so the
// never-decides-validity contract in docs/API.md is intact.
export type ValidationErrorReason =
  /** The field was left empty. */
  | "missing"
  /** Text was typed but does not name a real calendar day — incomplete
   *  entry, or a day that does not exist such as 31.02. */
  | "impossible-date"
  /** A real date that shouldDisableDate rejects. */
  | "not-selectable";

// The themes shipped in the stylesheet. Each is a block redefining the same
// --rldp-* token set under [data-rldp-theme="<name>"]; this prop stamps that
// attribute on the root. The attribute path stays available for CSS-only
// consumers, and because themes set inheritable custom properties they nest:
// the nearest themed ancestor wins.
//
// Leaving themeName unset stamps NOTHING, so a theme set on an ancestor
// still applies. "default" is therefore not the same as unset: it is the
// explicit way to opt a picker back out of an ancestor's theme.
export type ThemeName = "default" | "minimal" | "soft" | "high-contrast";

// The hand-maintained strings, and ONLY those Intl cannot produce. Month
// names, weekday names, the long-form echo and the navigation targets are
// all derived and stay derived — this is the whole premise of the package,
// and a labels map that duplicated them would rot per locale exactly the
// way the bundled-locale-file approach does.
//
// Duet needed roughly thirteen such strings per locale. Ours is four,
// because Intl supplies the rest.
export interface Labels {
  /** Announced once, the first time keyboard focus enters the days grid —
   *  the APG date-picker dialog's one-time help. */
  keyboardHelp: string;
  /** Accessible name of the calendar trigger while no date is committed. */
  openCalendar: string;
  /** Prefixes the committed date in the trigger's accessible name, giving
   *  "Change date, 17 November 2026". The date itself comes from Intl. */
  changeDate: string;
  /** Accessible name of the trigger while the calendar is open, which is
   *  what pressing it then does. */
  closeCalendar: string;
  /** OVERRIDE ONLY. The default is Intl-derived and better than a static
   *  string: the buttons are named with the month and year they navigate
   *  to ("August 2026"), or with the target year in the months view. Set
   *  these only if you need a fixed wording. */
  previousMonth?: string;
  nextMonth?: string;
}

// English defaults. A consumer localizing the picker overrides these four;
// everything else follows the locale prop on its own.
const DEFAULT_LABELS: Labels = {
  keyboardHelp:
    "Use the arrow keys to move between days, Page Up and Page Down to change month, and Enter to select.",
  openCalendar: "Open calendar",
  changeDate: "Change date",
  closeCalendar: "Close calendar",
};

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
  /** Overrides what counts as "today" (the ring, the default view month,
   *  the default keyboard target, the default year range). A local-midnight
   *  Date. Wins over timeZone. For deterministic tests and screenshots, and
   *  for consumers whose "today" is not a wall-clock fact. */
  today?: Date;
  /** IANA timezone "today" is derived in — for availability rules that run
   *  on a fixed business calendar day (a shop selling from one country to
   *  visitors a whole day away in either direction). "default" and
   *  "system" both mean the visitor's own zone; invalid names fall back to
   *  it. Committed values remain local-midnight Dates regardless — this
   *  never converts the value. See docs/DECISIONS.md D16 and the exported
   *  todayInTimeZone helper. */
  timeZone?: string;
  /** Render the long-form echo under the field. Default true, which is
   *  0.1.0 behaviour. Turn it off when the surrounding form already
   *  restates the date — the echo exists so a day/month transposition is
   *  visible, and a second copy of it is noise. */
  showEcho?: boolean;
  /** Render the weekday column headers above the days grid. Default true.
   *  The grid keeps its row and cell semantics either way. */
  showWeekdayHeader?: boolean;
  /** Mark today in the days grid. Default true. Turning it off removes the
   *  marker in BOTH modalities — the data-today attribute the stylesheet
   *  draws the ring from, and the aria-current="date" a screen reader
   *  announces — because a marker hidden from one and not the other is a
   *  worse contract than no marker. Consumers whose "today" is a
   *  fixed-timezone business day, rather than the visitor's, are the case
   *  this exists for; see the note at localToday. */
  showTodayMarker?: boolean;
  /** Reports why a TYPED entry did not commit — see the
   *  ValidationErrorReason type. Never fires for calendar clicks, which
   *  cannot produce an invalid date. The component only reports; it does
   *  not render anything or change hasError. */
  onValidationError?: (reason: ValidationErrorReason) => void;
  /** Fired when the user tries to open the picker while it is disabled
   *  (e.g. while a prerequisite field is still empty) so the form can guide
   *  the user to the field they must fill first. */
  onDisabledOpenAttempt?: () => void;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Appended to the root element's class list. */
  className?: string;
  /** Selects one of the shipped themes by stamping data-rldp-theme on the
   *  root — see the ThemeName type. Unset means "inherit whatever theme an
   *  ancestor set, if any". */
  themeName?: ThemeName;
  /** Per-slot class overrides — see the Slot type. Appended after the
   *  built-in classes, never replacing them. */
  classNames?: Partial<Record<Slot, string>>;
  /** Per-slot inline styles, keyed exactly like classNames. Inline styles
   *  win over the shipped stylesheet without any specificity argument,
   *  which is the point: it is the escape hatch for the one value a
   *  consumer cannot express as a token or a class. State slots layer on
   *  top of their part's own entry. */
  styles?: Partial<Record<Slot, React.CSSProperties>>;
  /** The strings Intl cannot supply — see the Labels type. Anything Intl
   *  can supply stays derived; the navigation entries are overrides only. */
  labels?: Partial<Labels>;
  /** Substitute the built-in inline SVG icons — see the IconName type.
   *  A substituted node is rendered as-is; the consumer owns its sizing. */
  icons?: Partial<Record<IconName, React.ReactNode>>;
  /**
   * Escape an `overflow: hidden` (or clipped) ancestor by rendering the
   * calendar popover into a different DOM node.
   *
   * - `false` / omitted (default): popover stays inside the component root
   *   as `position: absolute` — the 0.3.x behaviour, which is clipped by
   *   any overflow-hidden ancestor (card shells, modals, framed embeds).
   * - `true`: portal to `document.body` with `position: fixed` coordinates
   *   measured from the field.
   * - `HTMLElement`: portal to that node instead (e.g. a modal host that
   *   already owns stacking context).
   *
   * Opt-in so existing layouts do not reflow. Keyboard navigation,
   * Escape-to-close and outside-click close keep working; the outside-click
   * listener treats the portaled popover as inside the component. Works
   * inside a same-document iframe (including cross-origin embeds of the
   * host page — the portal targets the iframe's own document, never the
   * parent frame, which the browser would block).
   *
   * Theme tokens (`--rldp-*`) and `color-scheme` are copied from the root
   * onto the portaled node so ancestor-scoped theming still applies.
   */
  portal?: boolean | HTMLElement;
}

/**
 * Whether a value is a DOM element, without `instanceof`.
 *
 * `instanceof HTMLElement` answers "was this built by THIS realm's constructor",
 * which is not the question. An element from an iframe, a popup window, or a
 * consumer's jsdom container is a valid portal host and fails that check, so the
 * component would fall back to rendering in-tree — the exact clipping the caller
 * used `portal` to escape, with nothing logged to explain it.
 *
 * nodeType 1 is ELEMENT_NODE. Checking `appendChild` too keeps out plain objects
 * that merely carry a `nodeType` field.
 */
function isElement(value: unknown): value is HTMLElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Node).nodeType === 1 &&
    typeof (value as HTMLElement).appendChild === "function"
  );
}

// Join class fragments, skipping empty ones — keeps the package free of a
// classnames-style dependency.
const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");

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
// Built-in glyphs take their class and data-part from the anatomy like every
// other element. A glyph substituted through the icons prop is rendered
// as-is, so it carries neither — the consumer owns that node completely.
type IconProps = { className?: string; "data-part"?: string };

const CalendarIcon: React.FC<IconProps> = ({
  className,
  "data-part": part,
}) => (
  <svg
    className={className}
    data-part={part}
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
const ChevronLeft: React.FC<IconProps> = ({ className, "data-part": part }) => (
  <svg
    className={className}
    data-part={part}
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
const ChevronRight: React.FC<IconProps> = ({
  className,
  "data-part": part,
}) => (
  <svg
    className={className}
    data-part={part}
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
const ChevronDown: React.FC<IconProps> = ({ className, "data-part": part }) => (
  <svg
    className={className}
    data-part={part}
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
// year range — derived in the visitor's local time by default, matching the
// local-midnight Dates the component emits. When a consumer's
// shouldDisableDate rules run on a fixed business calendar day instead, a
// visitor-local marker can ring an already-disabled neighbouring day near
// midnight — the bug the source product hit and fixed by pinning its
// business timezone. The timeZone and today props restore that guarantee
// generically (decision D16).
const localToday = (): Date => startOfDay(new Date());

// Local-midnight "today" as observed in an arbitrary IANA timezone: format
// the current instant in that zone, rebuild the wall-clock date as a plain
// local Date. This is the seller's-calendar-day case — availability rules
// anchored to one business timezone while visitors sit up to a full day
// away in either direction. Exported so consumers can build their
// shouldDisableDate on the same business day the component's marker uses.
// An invalid zone name falls back to the visitor's local today rather than
// throwing — the same never-throw posture as resolveLocale.
export const todayInTimeZone = (timeZone: string): Date => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const num = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const y = num("year");
    const m = num("month");
    const d = num("day");
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return localToday();
    }
    return new Date(y, m - 1, d);
  } catch {
    return localToday();
  }
};
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

// Typed digits are normalized to ASCII before parsing. This used to handle
// exactly two ranges by hand — Eastern Arabic-Indic (٠-٩) and Extended
// (۰-۹) — which meant a user whose locale defaults to beng, deva, mymr or
// any other numbering system could not type a date at all: their digits hit
// the non-digit filter and vanished.
//
// The map is generated from Intl.NumberFormat instead, one entry per digit
// per numbering system the engine knows. That is the only version of this
// that stays correct as CLDR grows without anyone maintaining a table; it
// is React Aria's technique (ROADMAP Track 4).
let digitMap: Map<string, string> | null = null;

// Used only by engines predating Intl.supportedValuesOf (ES2022). Not an
// attempt at completeness — just the systems that are a locale default
// somewhere, so those users keep working on an older engine.
const FALLBACK_NUMBERING_SYSTEMS = [
  "arab",
  "arabext",
  "beng",
  "deva",
  "gujr",
  "guru",
  "khmr",
  "knda",
  "laoo",
  "mlym",
  "mymr",
  "orya",
  "taml",
  "telu",
  "thai",
  "tibt",
];

const buildDigitMap = (): Map<string, string> => {
  const map = new Map<string, string>();
  let systems: readonly string[] = FALLBACK_NUMBERING_SYSTEMS;
  try {
    const supported = (
      Intl as typeof Intl & {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf?.("numberingSystem");
    if (supported && supported.length > 0) systems = supported;
  } catch {
    /* older engine: the fallback list above still covers the defaults */
  }
  for (const system of systems) {
    let format: Intl.NumberFormat;
    try {
      format = new Intl.NumberFormat(`en-u-nu-${system}`, {
        useGrouping: false,
      });
    } catch {
      continue; // engine does not know this numbering system
    }
    for (let digit = 0; digit <= 9; digit++) {
      const glyph = format.format(digit);
      // Decimal-digit glyphs only. Algorithmic systems format 1 as "I"
      // (roman) or 5 as "五" (hanidec); those are letters, not digits, and
      // silently reading a letter as a digit would be worse than ignoring
      // it. \p{Nd} is exactly the right test.
      if (!/^\p{Nd}$/u.test(glyph)) continue;
      const existing = map.get(glyph);
      // A glyph two systems disagree about is ambiguous; keep the first.
      if (existing !== undefined && existing !== String(digit)) continue;
      map.set(glyph, String(digit));
    }
  }
  return map;
};

// Re-mask as dd.MM.yyyy while typing. Digits auto-mask (the iOS numeric
// keypad has no "." key), and separator KEYSTROKES are accepted rather than
// stripped: typing "1." pads the day to "01." and moves on to the month,
// which is how people actually type short dates. Swallowing the separator —
// what 0.2.0 did — made the field feel broken to anyone who typed one.
// Recognized separators cover the scripts the component ships for: dot,
// comma, slash, hyphen, Arabic comma, ideographic comma — plus whitespace and
// the two Cyrillic-layout phantoms below.
//
// Why "ю" and "б" are in a date mask: on a Cyrillic (ЙЦУКЕН) layout the
// physical QWERTY period and comma keys emit "ю" and "б". They were dropped as
// letters, so the surrounding digits closed up and "1ю8ю2026" became
// "18.20.26" — a different date, shown as if the user had typed it. Space did
// the same. A rejection would have been survivable; silently changing the date
// is not, and Ukrainian and Russian typists are a large share of this
// component's users.
//
// This stays an allowlist rather than "any non-digit is a separator", because
// interleaved junk from mid-string editing and paste must still be STRIPPED so
// the digits close up — see the mid-string editing test. Those two rules
// genuinely conflict, and the allowlist is what lets both hold: characters a
// user pressed meaning "next field" separate, characters that arrive as noise
// are dropped.
const SEPARATOR_CHAR = /[.,/\-،、\sюбЮБ]/;
const SEGMENT_MAX = [2, 2, 4] as const;
const maskTyped = (raw: string): string => {
  // Segments: day, month, year. Digits fill the current segment and roll
  // into the next when it is full (so pure-digit typing behaves exactly as
  // before); a separator closes the current segment early, padding a
  // single-digit day or month to two.
  const segments: string[] = [""];
  for (const char of raw) {
    let ascii: string | undefined;
    if (char >= "0" && char <= "9") {
      ascii = char;
    } else if (/^\p{Nd}$/u.test(char)) {
      // A digit in some other script. The map is built on first need and
      // cached for the page: ASCII typing, which is the overwhelming
      // majority, never pays for constructing ~60 Intl.NumberFormats.
      ascii = (digitMap ??= buildDigitMap()).get(char);
    }
    if (ascii !== undefined) {
      let idx = segments.length - 1;
      if (segments[idx].length >= SEGMENT_MAX[idx]) {
        if (idx === 2) break; // year full: the date is complete
        segments.push("");
        idx++;
      }
      segments[idx] += ascii;
    } else if (SEPARATOR_CHAR.test(char)) {
      const idx = segments.length - 1;
      // Only meaningful after at least one digit and before the year; an
      // empty or trailing-position separator is swallowed as before.
      if (idx < 2 && segments[idx].length >= 1) {
        if (segments[idx].length === 1) segments[idx] = `0${segments[idx]}`;
        segments.push("");
      }
    }
    // Other letters and symbols: dropped, so interleaved editing junk closes up.
  }
  let out = segments[0];
  if (segments.length > 1) out += `.${segments[1]}`;
  if (segments.length > 2) out += `.${segments[2]}`;
  return out;
};

// Accepts dd.MM.yyyy with . , / - separators (plus the Arabic and
// ideographic commas maskTyped accepts) and 1-digit day/month — pasted
// text can carry its own separators; masked input always matches.
const parseTyped = (raw: string): Date | null => {
  const m = raw
    .trim()
    .replace(/[,،、]/g, ".")
    .match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
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

/** A Date that is safe to hand to Intl, or null.
 *
 * `new Date("nope")` is a Date whose time value is NaN, and every
 * `Intl.DateTimeFormat.format()` call on one throws `RangeError: Invalid time
 * value`. Thrown from render, that unmounts the consumer's whole tree, so a
 * component that exists to format dates must never be the thing that takes an
 * application down over one. An unparseable value is treated as "no date" —
 * the same as null — which degrades to an empty field instead of a blank page.
 *
 * This also catches the realistic source: `new Date(apiResponse.someDate)`
 * where the field arrived null, undefined or malformed. */
const usableDate = (d: Date | null | undefined): Date | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;

export const LocaleDatePicker: React.FC<LocaleDatePickerProps> = ({
  value: rawValue,
  onChange,
  shouldDisableDate = noDayDisabled,
  locale = "en",
  placeholder,
  disabled,
  hasError,
  defaultCalendarMonth: rawDefaultCalendarMonth,
  minDate: rawMinDate,
  maxDate: rawMaxDate,
  onBlur,
  today: todayProp,
  timeZone,
  showEcho = true,
  showWeekdayHeader = true,
  showTodayMarker = true,
  onValidationError,
  onDisabledOpenAttempt,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  className,
  themeName,
  classNames,
  styles,
  labels,
  icons,
  portal = false,
}) => {
  const resolvedLocale = resolveLocale(locale);

  // Normalize once, at the boundary, so no formatter downstream can be handed
  // an Invalid Date. See usableDate above. Every Date prop passes through:
  // an Invalid defaultCalendarMonth reached the viewMonth state and crashed
  // at MOUNT via the always-computed header labels, and Invalid min/max
  // degrade the year grid to empty — all four are one bad API response away.
  const value = React.useMemo(() => usableDate(rawValue), [rawValue]);
  const defaultCalendarMonth = React.useMemo(
    () => usableDate(rawDefaultCalendarMonth),
    [rawDefaultCalendarMonth],
  );
  const minDate = React.useMemo(() => usableDate(rawMinDate), [rawMinDate]);
  const maxDate = React.useMemo(() => usableDate(rawMaxDate), [rawMaxDate]);

  // Every element the component renders takes its data-part, its class
  // override and its inline-style override from the same anatomy key, so
  // the published contract and the rendered DOM cannot drift apart.
  //
  // Trailing arguments name the STATE slots that are currently active
  // (daySelected, monthCurrent, ...). Both maps layer them on top of the
  // part's own entry, in the order given, so a consumer styling `day` and
  // `daySelected` gets what they would expect from CSS.
  const slotProps = (
    slot: PartSlot,
    base: string,
    ...states: Array<Slot | false | null | undefined>
  ) => {
    const active = states.filter(Boolean) as Slot[];
    let style: React.CSSProperties | undefined;
    if (styles) {
      for (const key of [slot, ...active]) {
        if (styles[key]) style = { ...style, ...styles[key] };
      }
    }
    return {
      "data-part": SLOT_PART[slot],
      className: cx(
        base,
        classNames?.[slot],
        ...active.map((state) => classNames?.[state]),
      ),
      style,
    };
  };

  const labelText = React.useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels],
  );

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"days" | "months" | "years">("days");
  // APG: announce the keyboard help ONCE, when focus first enters the grid.
  // Announcing on every move would talk over the day the user just landed
  // on; announcing on open would talk over a mouse user who never uses the
  // keyboard at all.
  const [gridHelpShown, setGridHelpShown] = React.useState(false);
  // First day of the month currently shown in the days grid.
  const [viewMonth, setViewMonth] = React.useState<Date>(() =>
    startOfDay(value || defaultCalendarMonth || new Date()),
  );
  // Text shown in the input while the user is typing; null = mirror value.
  const [draft, setDraft] = React.useState<string | null>(null);
  // Day that owns the roving tabindex inside the grid.
  const [focusDay, setFocusDay] = React.useState<Date | null>(null);
  // Measured after render: whether the popup flips above the field, the
  // horizontal offset (px) that keeps an in-tree popup inside the viewport,
  // and (when portaled) the fixed top/left in viewport coordinates.
  const [pos, setPos] = React.useState<{
    up: boolean;
    shift: number;
    top: number;
    left: number;
  }>({
    up: false,
    shift: 0,
    top: 0,
    left: 0,
  });
  // DOM focus only follows focusDay after keyboard navigation — opening the
  // popup with the mouse must NOT steal focus from the text input.
  const keyboardNavRef = React.useRef(false);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Resolved portal target. `true` → document.body; an element → that node;
  // false/undefined → in-tree. SSR-safe: `document` is only touched when
  // present (Node has neither during renderToString).
  //
  // Duck-typed rather than `instanceof HTMLElement`, because `instanceof` is
  // bound to the realm that defined the constructor. An element belonging to a
  // different document — an iframe's modal host, a popup window, a jsdom
  // container in a consumer's test — is a perfectly valid portal target but
  // fails `instanceof` in this realm, and the component would then silently
  // render in-tree. Silent is the problem: the caller asked for a portal
  // precisely because in-tree gets clipped, so the failure would surface as the
  // bug they were escaping, with no error to explain it.
  const portalTarget: HTMLElement | null =
    portal === true
      ? typeof document !== "undefined"
        ? document.body
        : null
      : isElement(portal)
        ? portal
        : null;
  const usePortal = portalTarget !== null;

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
  // Column headers show the short weekday but are announced with the long
  // one, the role="columnheader" equivalent of the APG example's
  // <th abbr="Sunday">Su</th>.
  const weekdayLongFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        calendar: "gregory",
        weekday: "long",
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

  // "Today" per decision D16: an injected date wins, then a business
  // timezone, then the visitor's own clock.
  const resolveToday = (): Date => {
    // usableDate, not a truthiness check: an Invalid Date is truthy, and
    // startOfDay() would propagate its NaN into every formatter downstream.
    const injected = usableDate(todayProp);
    if (injected) return startOfDay(injected);
    if (timeZone && timeZone !== "default" && timeZone !== "system") {
      return todayInTimeZone(timeZone);
    }
    return localToday();
  };

  const openPopup = () => {
    if (disabled) {
      onDisabledOpenAttempt?.();
      return;
    }
    // An uncommitted but fully typed draft wins over the committed value:
    // reopening the calendar right after typing must show the month that
    // was just typed, not the stale committed one.
    const typed = draft !== null ? parseTyped(draft) : null;
    const base = typed || value || defaultCalendarMonth || resolveToday();
    setViewMonth(clampMonth(startOfDay(base)));
    setFocusDay(typed ? startOfDay(typed) : value ? startOfDay(value) : null);
    setView("days");
    keyboardNavRef.current = false;
    setGridHelpShown(false);
    setOpen(true);
  };

  const close = React.useCallback((refocus = false) => {
    setOpen(false);
    setView("days");
    keyboardNavRef.current = false;
    setGridHelpShown(false);
    if (refocus) inputRef.current?.focus();
  }, []);

  // Outside interaction closes the popup. `mousedown` (not click) so the
  // popup is gone before any other control processes the press. When the
  // popover is portaled it is no longer a DOM descendant of the root, so
  // both containers are checked — a click on a day must not count as
  // "outside".
  React.useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popupRef.current?.contains(t)) {
        return;
      }
      close();
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

  // Copy --rldp-* custom properties and color-scheme from the component
  // root onto a portaled popover. Portaling detaches the node from the
  // root's inheritance chain, so without this an ancestor theme (or a
  // token set on a form card) would silently stop applying to the calendar.
  const syncPortaledTheme = React.useCallback(() => {
    const root = rootRef.current;
    const pop = popupRef.current;
    if (!root || !pop) return;
    const cs = getComputedStyle(root);
    for (let i = 0; i < cs.length; i++) {
      const name = cs.item(i);
      if (name.startsWith("--rldp")) {
        pop.style.setProperty(name, cs.getPropertyValue(name));
      }
    }
    const scheme = cs.colorScheme;
    if (scheme) pop.style.colorScheme = scheme;
  }, []);

  // Position the popup from its real rendered size: flip above the field
  // when the space below is too small, and shift (or, when portaled, place)
  // horizontally so it never leaves the viewport. Re-measured when the view
  // changes — the month/year grids are shorter than the days grid — and on
  // scroll/resize while portaled, because fixed coords go stale.
  useIsoLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const pop = popupRef.current;
    if (!root || !pop) return;

    const measure = () => {
      const r = root.getBoundingClientRect();
      const ph = pop.offsetHeight;
      const pw = pop.offsetWidth;
      const spaceBelow = window.innerHeight - r.bottom;
      // When neither side fits fully, open toward the roomier side; the page
      // can scroll to reveal the rest (in-tree) or the fixed coords place it
      // on the roomier side (portaled).
      const up = spaceBelow < ph + 8 && r.top > spaceBelow;
      if (usePortal) {
        let left = r.left;
        const maxLeft = window.innerWidth - 8 - pw;
        if (left > maxLeft) left = maxLeft;
        if (left < 8) left = 8;
        const top = up ? r.top - ph - 4 : r.bottom + 4;
        setPos((p) =>
          p.up === up && p.top === top && p.left === left && p.shift === 0
            ? p
            : { up, shift: 0, top, left },
        );
        syncPortaledTheme();
      } else {
        let shift = 0;
        const maxLeft = window.innerWidth - 8 - pw;
        if (r.left > maxLeft) shift = maxLeft - r.left;
        if (r.left + shift < 8) shift = 8 - r.left;
        setPos((p) =>
          p.up === up && p.shift === shift && p.top === 0 && p.left === 0
            ? p
            : { up, shift, top: 0, left: 0 },
        );
        // Nudge the page so the whole calendar is on screen (no-op when it is).
        // Portaled popovers are already viewport-placed; do not scroll the page.
        requestAnimationFrame(() => {
          popupRef.current?.scrollIntoView({ block: "nearest" });
        });
      }
    };

    measure();

    if (!usePortal) return;
    // Capture-phase scroll catches overflow containers between the field and
    // the viewport — window scroll alone would leave the fixed calendar behind.
    //
    // Coalesced to one measure per frame. `measure` reads
    // getBoundingClientRect + offsetHeight + offsetWidth, so it forces layout
    // three times; scroll fires far faster than a frame on a touch device, and
    // this component's whole reason to exist is running on checkout forms,
    // where a janky calendar during a scroll is very visible. Positioning can
    // only be observed once per paint anyway, so the extra work bought nothing.
    let frame = 0;
    const onScrollOrResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // The popup can unmount between the event and the frame.
        if (popupRef.current) measure();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, view, viewMonth, usePortal, syncPortaledTheme]);

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
      onValidationError?.("missing");
      return undefined;
    }
    const parsed = parseTyped(draft);
    setDraft(null); // invalid input reverts to the committed value
    if (!parsed) {
      onValidationError?.("impossible-date");
      return undefined;
    }
    if (shouldDisableDate(parsed)) {
      onValidationError?.("not-selectable");
      return undefined;
    }
    const d = startOfDay(parsed);
    onChange(d);
    return d;
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

  // role="grid" requires the cells to be grouped into rows, so the flat cell
  // list above is also sliced into weeks. Both shapes are kept: the flat list
  // is what the roving-target search scans, the rows are what renders.
  const weeks = React.useMemo(() => {
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < daysGrid.length; i += 7) {
      rows.push(daysGrid.slice(i, i + 7));
    }
    return rows;
  }, [daysGrid]);

  const weekdayLabels = React.useMemo(() => {
    // 2024-06-02 was a Sunday; offset from it to label each column.
    const labels: { short: string; long: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(2024, 5, 2 + ((weekStart + i) % 7));
      labels.push({
        short: weekdayFmt.format(day),
        long: weekdayLongFmt.format(day),
      });
    }
    return labels;
  }, [weekStart, weekdayFmt, weekdayLongFmt]);

  const today = resolveToday();

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
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - 7,
        );
        break;
      case "ArrowDown":
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() + 7,
        );
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

  // The year span runs a century-plus back by default, so the years grid
  // must bring the current view year into sight when it opens — otherwise
  // the list opens at the oldest year and the user scrolls for decades.
  // scrollIntoView is optional-chained because jsdom does not implement it.
  React.useEffect(() => {
    if (view !== "years") return;
    const el = popupRef.current?.querySelector<HTMLElement>(
      '[data-part="year"][data-current]',
    );
    el?.scrollIntoView?.({ block: "center" });
  }, [view]);

  // --- Months / years grids ------------------------------------------------
  const yearNow = today.getFullYear();
  const yearsRange = React.useMemo(() => {
    // Without an explicit minDate the year grid used to start at the
    // CURRENT year, which quietly made past years unreachable through the
    // year view — hostile to the birth-date use case, where a 1967 entry
    // is routine, and the kind of gap users read as "the app does not
    // allow earlier dates". 120 years back is the span birth-date
    // dropdowns conventionally offer. Month navigation and typed entry
    // were never limited; this widens only the year GRID. Selection
    // stays governed solely by shouldDisableDate either way.
    const from = minDate ? minDate.getFullYear() : yearNow - 120;
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
    (view === "months" ? viewMonth.getFullYear() - 1 < yearMin : !canPrevMonth);
  const headerNextDisabled =
    view === "years" ||
    (view === "months" ? viewMonth.getFullYear() + 1 > yearMax : !canNextMonth);
  // Named with the month and year they navigate to, from Intl. A labels
  // entry replaces that only if the consumer supplied one.
  const headerPrevLabel =
    labelText.previousMonth ??
    (view === "months"
      ? String(viewMonth.getFullYear() - 1)
      : monthTitleFmt.format(prevMonthDate));
  const headerNextLabel =
    labelText.nextMonth ??
    (view === "months"
      ? String(viewMonth.getFullYear() + 1)
      : monthTitleFmt.format(nextMonthDate));

  // The trigger restates the committed value, so a screen-reader user who
  // tabs past the field hears what is in it without opening the calendar.
  // It was aria-hidden before, which made it unreachable and unnamed; it
  // stays out of the tab order (tabIndex -1), because the input is the tab
  // stop and the parity contract keeps focus there.
  const triggerLabel = open
    ? labelText.closeCalendar
    : value
      ? `${labelText.changeDate}, ${fullDateFmt.format(value)}`
      : labelText.openCalendar;

  // Popover tree — built outside the return so createPortal is a plain
  // expression (not an IIFE), which keeps the react-hooks ref linter happy
  // about event handlers that close over commit/close.
  const popoverTree = !open ? null : (
            <div
              ref={popupRef}
              role="dialog"
              aria-label={ariaLabel}
              // Keep focus in the input while clicking inside the popup: a
              // mousedown blur would run the parent's validation against a
              // still-empty field and flash a false error.
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName !== "INPUT") {
                  e.preventDefault();
                }
              }}
              data-placement={pos.up ? "top" : "bottom"}
              data-portaled={usePortal || undefined}
              {...slotProps("popover", "rldp-popover")}
              // In-tree: measured horizontal shift keeps the absolute popover in
              // the viewport. Portaled: fixed top/left from the field's viewport
              // rect. Consumer styles layer on top either way.
              style={{
                ...(usePortal
                  ? {
                      position: "fixed" as const,
                      top: pos.top,
                      left: pos.left,
                    }
                  : { left: pos.shift }),
                ...styles?.popover,
              }}
            >
              {/* One-time keyboard help. The region is mounted empty with the
              popover so that filling it later is a live-region UPDATE — a
              region that appears already populated is not announced. */}
              <span
                {...slotProps("keyboardHelp", "rldp-sr-only")}
                aria-live="polite"
              >
                {gridHelpShown ? labelText.keyboardHelp : ""}
              </span>

              {/* Header */}
              <div {...slotProps("header", "rldp-header")}>
                <button
                  type="button"
                  {...slotProps("navPrevious", "rldp-nav")}
                  disabled={headerPrevDisabled}
                  aria-label={headerPrevLabel}
                  onClick={headerPrev}
                >
                  {icons?.chevronLeft ?? (
                    <ChevronLeft {...slotProps("navIcon", "rldp-nav-icon")} />
                  )}
                </button>
                {/* Month + year read as dropdown selects: bordered pill with a
                caret that flips while its grid is open. */}
                <div {...slotProps("selects", "rldp-selects")}>
                  {/* aria-atomic so the month and year are announced as one
                  string. Without it a screen reader may read only the part
                  that changed — "2027" alone when navigating across a year
                  boundary, or a bare month name — which is Cally's
                  documented fix for the same fragment problem. */}
                  <span
                    {...slotProps("liveRegion", "rldp-sr-only")}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {monthTitleFmt.format(viewMonth)}
                  </span>
                  <button
                    type="button"
                    {...slotProps("monthPill", "rldp-pill")}
                    data-active={view === "months" || undefined}
                    aria-expanded={view === "months"}
                    onClick={() =>
                      setView(view === "months" ? "days" : "months")
                    }
                  >
                    {monthLongFmt.format(viewMonth)}
                    {icons?.chevronDown ?? (
                      <ChevronDown {...slotProps("caret", "rldp-caret")} />
                    )}
                  </button>
                  <button
                    type="button"
                    {...slotProps("yearPill", "rldp-pill")}
                    data-active={view === "years" || undefined}
                    aria-expanded={view === "years"}
                    onClick={() => setView(view === "years" ? "days" : "years")}
                  >
                    {viewMonth.getFullYear()}
                    {icons?.chevronDown ?? (
                      <ChevronDown {...slotProps("caret", "rldp-caret")} />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  {...slotProps("navNext", "rldp-nav")}
                  disabled={headerNextDisabled}
                  aria-label={headerNextLabel}
                  onClick={headerNext}
                >
                  {icons?.chevronRight ?? (
                    <ChevronRight {...slotProps("navIcon", "rldp-nav-icon")} />
                  )}
                </button>
              </div>

              {/* Days.
              role="grid" with aria-selected is the APG/Duet side of the
              schism the roadmap records (Cally's aria-pressed is the other);
              grid matches how screen readers navigate tables and what audit
              checklists look for. The migration is an accessibility
              correction, so it ships as a default rather than an opt-in.
              aria-selected lives on the gridcell because a button role does
              not permit it; aria-current="date" now marks TODAY, which is
              what it means, instead of the selection. */}
              {view === "days" && (
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label={monthTitleFmt.format(viewMonth)}
                  {...slotProps("grid", "rldp-grid")}
                  onKeyDown={onGridKeyDown}
                  // React's onFocus bubbles, so this fires however focus arrives
                  // — ArrowDown from the input, Tab onto the roving cell, or a
                  // click on a day.
                  onFocus={() => setGridHelpShown(true)}
                >
                  {showWeekdayHeader && (
                    <div {...slotProps("weekdays", "rldp-weekdays")} role="row">
                      {weekdayLabels.map((w, i) => (
                        <div
                          key={i}
                          role="columnheader"
                          aria-label={w.long}
                          {...slotProps("weekday", "rldp-weekday")}
                        >
                          {w.short}
                        </div>
                      ))}
                    </div>
                  )}
                  <div {...slotProps("days", "rldp-days")} role="rowgroup">
                    {weeks.map((week, wi) => (
                      <div
                        key={wi}
                        role="row"
                        {...slotProps("week", "rldp-week")}
                      >
                        {week.map((d, i) => {
                          if (!d) {
                            // Padding cell. It still carries role="gridcell" so
                            // every row has seven cells and grid navigation does
                            // not report a ragged table.
                            return (
                              <div
                                key={i}
                                role="gridcell"
                                aria-disabled="true"
                                {...slotProps("dayBlank", "rldp-daycell")}
                              />
                            );
                          }
                          const isDisabled = shouldDisableDate(d);
                          const isSelected = sameDay(d, value);
                          const isToday = showTodayMarker && sameDay(d, today);
                          const isRove =
                            roveTarget !== null && sameDay(d, roveTarget);
                          return (
                            <div
                              key={i}
                              role="gridcell"
                              aria-selected={isSelected}
                              {...slotProps("dayCell", "rldp-daycell")}
                            >
                              <button
                                type="button"
                                data-day={dayKey(d)}
                                // aria-disabled keeps the cell focusable so
                                // arrow-key traversal never dead-ends on a
                                // disabled date.
                                aria-disabled={isDisabled || undefined}
                                tabIndex={isRove ? 0 : -1}
                                aria-label={formatDayAccessibleName(d)}
                                aria-current={isToday ? "date" : undefined}
                                data-selected={isSelected || undefined}
                                data-disabled={isDisabled || undefined}
                                data-today={
                                  (isToday && !isSelected) || undefined
                                }
                                {...slotProps(
                                  "day",
                                  "rldp-day",
                                  isSelected && "daySelected",
                                  isDisabled && "dayDisabled",
                                  isToday && !isSelected && "dayToday",
                                )}
                                onClick={() => {
                                  if (!isDisabled) commit(d);
                                }}
                                onFocus={() => setFocusDay(d)}
                              >
                                {d.getDate()}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Months */}
              {view === "months" && (
                <div {...slotProps("months", "rldp-months")}>
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
                        {...slotProps(
                          "month",
                          "rldp-month",
                          isCurrent && "monthCurrent",
                        )}
                        data-current={isCurrent || undefined}
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
                <div {...slotProps("years", "rldp-years")}>
                  {yearsRange.map((y) => {
                    const isCurrent = y === viewMonth.getFullYear();
                    return (
                      <button
                        key={y}
                        type="button"
                        {...slotProps(
                          "year",
                          "rldp-year",
                          isCurrent && "yearCurrent",
                        )}
                        data-current={isCurrent || undefined}
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

  );

  const portaledPopover =
    popoverTree && usePortal && portalTarget
      ? createPortal(popoverTree, portalTarget)
      : popoverTree;

  return (
    <div
      ref={rootRef}
      data-rldp-theme={themeName}
      {...slotProps("root", cx("rldp-root", className))}
    >
      <div
        {...slotProps("field", "rldp-field")}
        data-error={hasError || undefined}
        data-disabled={disabled || undefined}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          {...slotProps("input", "rldp-input")}
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
            const masked = maskTyped(e.target.value);
            setDraft(masked);
            // Follow the typing in the open calendar: once the draft names
            // a complete date, navigate the grid to it and hand it the
            // roving target. DOM focus stays in the input (keyboardNavRef
            // is untouched) so typing is never interrupted, and clampMonth
            // keeps the min/max navigation bounds authoritative. Partial
            // drafts do not navigate — guessing the year wrong and yanking
            // the view around mid-entry is worse than waiting.
            if (open) {
              const parsed = parseTyped(masked);
              if (parsed) {
                setViewMonth(clampMonth(startOfDay(parsed)));
                setFocusDay(startOfDay(parsed));
              }
            }
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
          aria-label={triggerLabel}
          disabled={disabled}
          {...slotProps("trigger", "rldp-trigger")}
          onMouseDown={(e) => {
            // Runs before the document mousedown-close listener would; toggle
            // without letting the input blur first.
            e.preventDefault();
            if (open) close();
            else openPopup();
          }}
        >
          {icons?.calendar ?? (
            <CalendarIcon {...slotProps("triggerIcon", "rldp-trigger-icon")} />
          )}
        </button>
      </div>

      {/* Committed date in words (localized). Month rendered as a WORD makes
          a day/month transposition while typing immediately visible, and
          doubles as confirmation that a typed edit was accepted. */}
      {showEcho && value && (
        <p {...slotProps("echo", "rldp-echo")}>{fullDateFmt.format(value)}</p>
      )}

      {portaledPopover}
    </div>
  );
};
