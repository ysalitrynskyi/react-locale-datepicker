import React from "react";
import { createPortal, flushSync } from "react-dom";

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
  /** The visitor emptied the field while no date is committed. An
   *  untouched empty field reports nothing. */
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
  /** Id(s) of the element(s) naming the field, forwarded to the input. With
   *  `id` this is the way to label the field without wrapping it in a
   *  <label>: a wrapping label takes its name from everything inside it,
   *  including an in-tree calendar while it is open. */
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Forwarded to the input, so `<label htmlFor>` can name it. */
  id?: string;
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
  /**
   * When the on-screen keyboard is allowed to appear.
   *
   * Devices with a physical keyboard cannot tell this prop exists: `inputMode`
   * governs only the *virtual* keyboard, so the suppression is inert there and
   * typing stays possible everywhere, throughout. That is why the attribute is
   * not gated on detecting a touch device — see the `inputMode` note at the
   * input for why detecting one would be too late to help anyway.
   *
   * - `"second-tap"` (default): the first tap on the field opens the calendar
   *   with the keyboard suppressed (`inputMode="none"`). Tapping the text
   *   again while the calendar is open is read as deliberate intent to type,
   *   and raises the keyboard. Picking a day never raises it.
   * - `"immediate"`: the pre-0.5 behaviour — any tap on the field focuses it
   *   and the keyboard appears.
   *
   * The default changed in 0.5.0. On a phone the keyboard costs roughly half
   * the viewport, and it was appearing for the majority of taps that only
   * wanted to pick a date from the grid — including, before the accompanying
   * fix, on the tap that *selected* a day and closed the calendar.
   */
  manualEntryOnTouch?: "second-tap" | "immediate";
  /**
   * Layout direction of the field and the calendar.
   *
   * - omitted (default): inherit the page's direction from the nearest
   *   ancestor, as before — the page owns its layout, and a picker should not
   *   flip on its own inside a form laid out the other way.
   * - `"auto"`: derive it from `locale` (Arabic, Hebrew, Persian, Urdu and the
   *   other right-to-left scripts lay out right to left) — for a picker whose
   *   locale differs from the page's.
   * - `"ltr"` / `"rtl"`: explicit.
   *
   * Whichever applies is also stamped on the popover, so a portaled calendar
   * keeps the field's direction (a portal leaves the ancestor that set it).
   * See docs/DECISIONS.md D19.
   */
  direction?: "ltr" | "rtl" | "auto";
}

/**
 * Whether the pointer being used right now is a finger rather than a mouse.
 *
 * Read at interaction time, never cached into state: a hybrid device answers
 * differently between two taps, and the only thing that matters is what the
 * current interaction was made with. A wrong answer is cheap in one direction
 * and expensive in the other — treating a mouse as a finger merely delays the
 * keyboard by one click, while treating a finger as a mouse pops the keyboard
 * over half the screen — so an environment that cannot answer (`matchMedia`
 * absent, SSR, jsdom) is treated as a mouse and keeps the old behaviour.
 */
function isCoarsePointer(): boolean {
  const mq = coarsePointerQuery();
  return mq ? mq.matches : false;
}

function coarsePointerQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return null;
  try {
    return window.matchMedia("(pointer: coarse)");
  } catch {
    // jsdom's matchMedia stub throws on some media queries.
    return null;
  }
}

// The pointer type and time of the last pointerdown inside the widget.
type PointerNote = { type: string; at: number };

/**
 * What actually produced this click: a finger, a mouse, or a keyboard.
 *
 * Read from the event rather than from the device, because the device is the
 * wrong question. `(pointer: coarse)` describes the *primary* pointer, so a
 * touchscreen laptop driven by its trackpad and the same laptop driven by a
 * finger are indistinguishable to it — and those two want opposite handling.
 * `PointerEvent.pointerType` is the interaction itself and is exact.
 *
 * `detail === 0` means the click was synthesized rather than pressed, which is
 * how assistive tech and Enter/Space-on-a-button arrive. Checked first: those
 * are keyboard users whatever hardware is attached.
 *
 * The media query is only a fallback, for synthetic events and any browser that
 * still delivers a plain MouseEvent here.
 *
 * The pointerdown that started this click is preferred over the click itself.
 * Safari 18.2+ reports a touch-generated click as pointerType "mouse" (WebKit
 * bug 282988) while the pointerdown of the same tap correctly says "touch", so
 * trusting the click classified every finger on that Safari as a mouse: the
 * second tap never raised the keyboard and a picked day refocused the field.
 *
 * A pen is handled like a finger on purpose: on tablets a focused text input
 * raises the on-screen keyboard (or a handwriting panel) for a stylus too, and
 * keeping that off the screen is the whole point of the touch handling.
 */
function activationOf(
  e: { detail: number; nativeEvent: Event; timeStamp: number },
  lastPointer: PointerNote | null,
): "keyboard" | "touch" | "mouse" {
  if (e.detail === 0) return "keyboard";
  const pressed =
    lastPointer && Math.abs(e.timeStamp - lastPointer.at) < 1000
      ? lastPointer.type
      : undefined;
  const pointerType =
    pressed ?? (e.nativeEvent as Partial<PointerEvent>)?.pointerType;
  if (pointerType === "touch" || pointerType === "pen") return "touch";
  if (pointerType === "mouse") return "mouse";
  return isCoarsePointer() ? "touch" : "mouse";
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

// One letter in title case. JavaScript only has the upper-case mapping, and
// the two differ where it shows: Georgian Mkhedruli has no title case at all
// (its upper case is Mtavruli, an all-caps display script, so a Georgian echo
// began "Ოთხშაბათი" — CSS capitalize, which uses title case, never did that),
// and the Latin digraph letters have title-case forms of their own (ǆ → ǅ).
const TITLECASE_DIGRAPH: Record<string, string> = {
  "Ǆ": "ǅ", "ǆ": "ǅ", "Ǉ": "ǈ", "ǉ": "ǈ", "Ǌ": "ǋ", "ǌ": "ǋ", "Ǳ": "ǲ", "ǳ": "ǲ",
};
const titlecaseLetter = (letter: string, lang: string | undefined): string => {
  if (/^[\u10D0-\u10FF]$/.test(letter)) return letter;
  return TITLECASE_DIGRAPH[letter] ?? letter.toLocaleUpperCase(lang);
};

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
//
// The alias is matched on the canonicalized LANGUAGE subtag, not on the raw
// string. Language subtags are case-insensitive and usually carry a region,
// so "UA" (the usual spelling of the same country code) and "ua-UA" are the
// same mistake as "ua". Matching the exact string missed both, and because
// Intl does not throw for a well-formed but unknown language, they did not
// fall back either: they silently formatted in the host's default language.
const LOCALE_ALIASES: Record<string, string> = { ua: "uk" };
// Cache keyed by the raw input: validation constructs an Intl.DateTimeFormat,
// which is far more expensive than the plain object lookup this replaced,
// and the component calls resolveLocale on every render.
const resolveCache = new Map<string, string>();
export const resolveLocale = (locale: string): string => {
  const cached = resolveCache.get(locale);
  if (cached !== undefined) return cached;
  let resolved: string;
  try {
    // getCanonicalLocales throws the same RangeError Intl would for a
    // malformed tag, so it doubles as the validity check for the raw input.
    const [canonical] = Intl.getCanonicalLocales(locale || "en");
    const [language, ...rest] = canonical.split("-");
    const alias = LOCALE_ALIASES[language];
    const candidate = alias ? [alias, ...rest].join("-") : canonical;
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

// Text direction of a locale's script, for direction="auto". Intl.Locale
// exposes it as textInfo (older engines: a property; newer: getTextInfo());
// engines with neither fall back to the languages written right to left.
const RTL_LANGUAGES = new Set([
  "ar", "arc", "ckb", "dv", "fa", "he", "iw", "ks", "ps", "sd", "syr", "ug",
  "ur", "yi",
]);
function localeDirection(locale: string): "ltr" | "rtl" {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      textInfo?: { direction?: string };
      getTextInfo?: () => { direction?: string };
    };
    const info =
      typeof l.getTextInfo === "function" ? l.getTextInfo() : l.textInfo;
    if (info?.direction === "rtl" || info?.direction === "ltr") {
      return info.direction;
    }
    return RTL_LANGUAGES.has(l.language) ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}

// The direction an element inherits. A layout engine resolves dir (including
// dir="auto") and the CSS direction property into computed style; an
// environment without layout (jsdom) reports nothing there, so the nearest
// explicit dir attribute stands in.
function inheritedDirection(el: HTMLElement): "ltr" | "rtl" {
  const win = el.ownerDocument.defaultView;
  const computed = win ? win.getComputedStyle(el).direction : "";
  if (computed === "rtl" || computed === "ltr") return computed;
  return el.closest("[dir]")?.getAttribute("dir")?.toLowerCase() === "rtl"
    ? "rtl"
    : "ltr";
}

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

// Local-midnight Date for a calendar day. Every calendar construction in this
// file goes through here rather than `new Date(y, m, d)`, because that
// constructor reads years 0-99 as 1900-1999 (a legacy two-digit-year rule):
// year 99 silently became 1999, so a real date in that range could neither be
// parsed nor round-tripped through startOfDay. setFullYear has no such rule.
// Overflowing months and days still roll over exactly as the constructor's do,
// which the grid and keyboard arithmetic rely on.
const ymd = (y: number, m: number, d: number): Date => {
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, m, d);
  return date;
};

// The largest time value the component accepts, in either direction: the
// ECMAScript limit (8.64e15 ms) minus 400 days. The header always formats the
// previous and next month, Shift+PageUp/PageDown step a year, and a local
// timezone shifts the day by up to 14 hours, so a Date right at the limit is
// finite and still throws `Invalid time value` from those neighbours during
// render. The margin keeps every Date the grid can derive from an accepted one
// inside the representable range.
const SAFE_TIME = 8.64e15 - 400 * 864e5;
const isSafeTime = (t: number): boolean =>
  Number.isFinite(t) && Math.abs(t) <= SAFE_TIME;

const startOfDay = (d: Date): Date =>
  ymd(d.getFullYear(), d.getMonth(), d.getDate());

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
    return ymd(y, m - 1, d);
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
// The first and last months whose every day is inside SAFE_TIME. Navigation is
// bounded by these as well as by minDate/maxDate, so no amount of paging can
// walk the grid into a month whose labels throw.
// Upper bound on rendered year options; see yearsRange.
const MAX_YEAR_OPTIONS = 600;
// The shortest a portaled calendar is capped to, in px: about the header and
// one week. See the portaled branch of the measure effect.
const MIN_CAPPED_HEIGHT = 120;
const SAFE_MIN_KEY = monthKey(new Date(-SAFE_TIME)) + 1;
const SAFE_MAX_KEY = monthKey(new Date(SAFE_TIME)) - 1;
const monthFromKey = (k: number): Date => {
  const y = Math.floor(k / 12);
  return ymd(y, k - y * 12, 1);
};
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Default predicate: every day selectable. Module-level so the reference is
// stable across renders.
const noDayDisabled = (): boolean => false;

// The year is padded to four digits like the day and month are to two. The
// display format is dd.MM.yyyy and parseTyped requires exactly four year
// digits, so an unpadded year below 1000 ("01.01.999") was a string the field
// could show but never read back: the next blur reported it impossible.
const formatDisplay = (date: Date | null): string => {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const yyyy = y < 0 ? `-${String(-y).padStart(4, "0")}` : String(y).padStart(4, "0");
  return `${dd}.${mm}.${yyyy}`;
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
//
// Recognized separators are the keys a typist presses meaning "next field" on
// the layouts this component ships for: dot, comma, slash, hyphen and
// whitespace; the Arabic comma, decimal and thousands separators (U+060C,
// U+066B, U+066C — the decimal key on an Arabic keypad is not ".");
// the ideographic comma and full stop; the fullwidth dot, comma, slash and
// hyphen that a CJK IME's fullwidth mode emits next to the fullwidth digits the
// digit map already accepts; and the two Cyrillic-layout phantoms below. Each
// of these used to be dropped as junk, so the digits around it closed up and
// "1.8.2026" typed with one of them became "18.20.26" — a different date, shown
// as if the user had typed it.
//
// Why "ю" and "б" are in a date mask: on a Cyrillic (ЙЦУКЕН) layout the
// physical QWERTY period and comma keys emit "ю" and "б". A rejection would
// have been survivable; silently changing the date is not, and Ukrainian and
// Russian typists are a large share of this component's users.
//
// This stays an allowlist rather than "any non-digit is a separator", because
// interleaved junk from editing and paste must still be STRIPPED so the digits
// close up. Those two rules genuinely conflict, and the allowlist is what lets
// both hold: characters a user pressed meaning "next field" separate,
// characters that arrive as noise are dropped.
const SEPARATOR_CHAR = /[.,/\-،٫٬、。．，／－\sюбЮБ]/;
const SEGMENT_MAX = [2, 2, 4] as const;

// Digits normalized to ASCII (from any decimal numbering system Intl knows),
// recognized separators kept as markers, everything else dropped.
type TypedToken = { kind: "digit"; ascii: string } | { kind: "sep" };
const tokenize = (raw: string): TypedToken[] => {
  const tokens: TypedToken[] = [];
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
    if (ascii !== undefined) tokens.push({ kind: "digit", ascii });
    else if (SEPARATOR_CHAR.test(char)) tokens.push({ kind: "sep" });
  }
  return tokens;
};
const digitsOf = (tokens: TypedToken[]): string =>
  tokens.map((t) => (t.kind === "digit" ? t.ascii : "")).join("");

// The typing path: digits fill day, month and year and roll into the next
// segment when one is full; a separator closes the current segment early,
// padding a single-digit day or month to two.
//
// A separator that arrives once the year has started but is not complete
// means the input has more groups than a date does ("1.2.3.2026"). That used
// to be ignored, so the next group's digits were appended to the year and the
// field showed — and blur committed — 1 February 3202. The extra group is now
// kept as typed after a separator, which parseTyped rejects, so the mistake is
// visible and reported instead of turned into a real date.
const maskTokens = (tokens: TypedToken[]): string => {
  const segments: string[] = [""];
  let overflow = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (overflow) {
      overflow += token.kind === "digit" ? token.ascii : ".";
      continue;
    }
    let idx = segments.length - 1;
    if (token.kind === "digit") {
      if (segments[idx].length >= SEGMENT_MAX[idx]) {
        if (idx === 2) break; // year full: the date is complete
        segments.push("");
        idx++;
      }
      segments[idx] += token.ascii;
    } else if (idx < 2) {
      // Only meaningful after at least one digit; a leading separator is
      // swallowed as before.
      if (segments[idx].length >= 1) {
        if (segments[idx].length === 1) segments[idx] = `0${segments[idx]}`;
        segments.push("");
      }
    } else if (segments[2].length > 0 && segments[2].length < 4) {
      overflow = ".";
    }
    // A separator after a complete year (or before any year digit) is
    // swallowed: "01.02.2026." is still the date it shows.
  }
  let out = segments[0];
  if (segments.length > 1) out += `.${segments[1]}`;
  if (segments.length > 2) out += `.${segments[2]}`;
  return out + overflow.replace(/\.+/g, ".");
};

// A year-first date (ISO 8601 and everything machine-generated: "2026-07-17",
// "2026/07/17", "2026-07-17T14:30:00Z") arrives whole, by paste. The typing
// mask reads digits left to right as day, month, year, so it rolled "2012"
// into day 20 and month 12 and committed 20 December 315. A four-digit first
// group can never be a day, so it is unambiguous: reorder it instead. Junk is
// a boundary here (the "T" before an ISO time), unlike in the typing mask.
const yearFirst = (raw: string): string | null => {
  let shape = "";
  for (const char of raw) {
    if (char >= "0" && char <= "9") shape += char;
    else if (/^\p{Nd}$/u.test(char)) {
      shape += (digitMap ??= buildDigitMap()).get(char) ?? "x";
    } else shape += SEPARATOR_CHAR.test(char) ? "." : "x";
  }
  const m = shape.match(/^\.*(\d{4})\.+(\d{1,2})\.+(\d{1,2})(?!\d)/);
  if (!m) return null;
  return `${m[3].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[1]}`;
};

// An edit that changes digits somewhere other than at the end. The typing mask
// rebuilds every segment from the digit stream, which is right while the
// visitor types forward and wrong here: inserting "1" at the start of
// "15.03.2026" re-flowed the digits into "11.05.0320", and blur committed
// 11 May 320. When the edit leaves separators in place, they are now treated
// as fixed boundaries: groups are kept as typed and never padded (padding
// would move the caret under the visitor's next keystroke). A group that no
// longer fits — "115" as a day, a fourth group — is left on screen exactly as
// typed, so parseTyped rejects it and blur reports it instead of inventing a
// date.
const explicitGroups = (tokens: TypedToken[]): string => {
  const groups: string[] = [];
  let current = "";
  let seenDigit = false;
  let trailingSep = false;
  for (const token of tokens) {
    if (token.kind === "digit") {
      current += token.ascii;
      seenDigit = true;
      trailingSep = false;
    } else if (seenDigit && !trailingSep) {
      groups.push(current);
      current = "";
      trailingSep = true;
    }
  }
  if (!trailingSep) groups.push(current);
  const fits =
    groups.length <= 3 &&
    groups.every((g, i) => g.length <= SEGMENT_MAX[i]);
  if (!fits) return trailingSep ? `${groups.join(".")}.` : groups.join(".");
  return groups.join(".") + (trailingSep && groups.length < 3 ? "." : "");
};

// The text the field should show after the visitor turned `prev` into `raw`.
const nextTypedText = (prev: string, raw: string): string => {
  const iso = yearFirst(raw);
  if (iso) return iso;
  const tokens = tokenize(raw);
  // Typing forward, or a fresh paste into an empty field: the classic mask.
  if (prev === "" || raw.startsWith(prev)) return maskTokens(tokens);
  const prevTokens = tokenize(prev);
  // Only separators or junk changed — a deleted dot, a stray letter. The
  // date's digits are untouched, so the date is too: keep what was shown.
  // Except at the end of the text: Backspace over a trailing separator is how
  // a typist backs out of a group, and keeping it there made Backspace dead —
  // "1." pads to "01." and then could not be erased without selecting it.
  // What remains is a prefix of text this function produced, so it is shown
  // as is.
  if (digitsOf(tokens) === digitsOf(prevTokens)) {
    return prev.startsWith(raw) ? raw : prev;
  }
  // A replacement with no separators at all (select-all and type, or paste a
  // bare digit string) is new input from scratch: mask it.
  if (!tokens.some((t) => t.kind === "sep")) return maskTokens(tokens);
  return explicitGroups(tokens);
};

// Accepts d.M.yyyy and dd.MM.yyyy — the shapes the mask produces — with any
// recognized separator read as a dot, so pasted text that kept its own
// separators parses too.
const parseTyped = (raw: string): Date | null => {
  let normalized = "";
  for (const char of raw.trim()) {
    normalized += SEPARATOR_CHAR.test(char) ? "." : char;
  }
  const m = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const date = ymd(year, month - 1, day);
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
 * where the field arrived null, undefined or malformed.
 *
 * Recognized by its internal slot rather than `instanceof Date`, which only
 * answers "was this built by THIS realm's constructor": a Date from an iframe
 * or a test VM context is a real date and used to be treated as empty. A
 * foreign Date is copied into this realm so every later check sees an
 * ordinary one. `Object.create(Date.prototype)` passes `instanceof` but has no
 * time value and throws from getTime; it is rejected here instead. */
const usableDate = (d: unknown): Date | null => {
  if (Object.prototype.toString.call(d) !== "[object Date]") return null;
  let t: number;
  try {
    t = Date.prototype.getTime.call(d);
  } catch {
    return null;
  }
  if (!isSafeTime(t)) return null;
  return d instanceof Date ? d : new Date(t);
};

// Elements Tab would stop on, in document order. Deliberately layout-light so
// it works without a layout engine: disabled, inert, hidden and tabindex=-1
// controls are excluded by attribute, and the rendered check is skipped where
// no element has boxes at all (jsdom).
const FOCUSABLE =
  'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]';
const focusablesIn = (root: ParentNode | null | undefined): HTMLElement[] => {
  if (!root) return [];
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const hasLayout =
    !!doc?.documentElement &&
    doc.documentElement.getClientRects().length > 0;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      el.getAttribute("type") !== "hidden" &&
      !el.closest("[hidden],[inert]") &&
      (!hasLayout || el.getClientRects().length > 0),
  );
};
// The first focusable that follows `anchor` in its document, skipping
// anything `skip` claims (the popover, wherever a portal put it).
const nextFocusableAfter = (
  anchor: HTMLElement | null,
  skip: (el: HTMLElement) => boolean,
): HTMLElement | null => {
  if (!anchor) return null;
  return (
    focusablesIn(anchor.ownerDocument).find(
      (el) =>
        !anchor.contains(el) &&
        !skip(el) &&
        (anchor.compareDocumentPosition(el) & 4) !== 0, // FOLLOWING
    ) ?? null
  );
};

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
  "aria-labelledby": ariaLabelledBy,
  id,
  className,
  themeName,
  classNames,
  styles,
  labels,
  icons,
  portal = false,
  manualEntryOnTouch = "second-tap",
  direction,
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

  // An empty string is treated as "not given" for every label that names a
  // control: `previousMonth: ""` used to win over the Intl-derived name and
  // leave the button with an empty accessible name. keyboardHelp is the
  // exception — an empty string there is a legitimate "announce nothing".
  const labelText = React.useMemo(() => {
    const merged: Labels = { ...DEFAULT_LABELS };
    for (const [key, text] of Object.entries(labels ?? {}) as [
      keyof Labels,
      string | undefined,
    ][]) {
      if (text === undefined) continue;
      if (text === "" && key !== "keyboardHelp") continue;
      merged[key] = text;
    }
    return merged;
  }, [labels]);

  // Ids tying the input and the trigger to the dialog they open, and the
  // dialog to the heading that names it.
  const baseId = React.useId();
  const dialogId = `${baseId}-dialog`;
  const titleId = `${baseId}-title`;

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
  //
  // Mirrored in a ref because more than one handler can act on the same
  // draft within one event: an outside press commits it and the blur that
  // follows must see it as already committed, not commit (or report) it a
  // second time from a stale render's closure.
  const [draft, setDraftState] = React.useState<string | null>(null);
  const draftRef = React.useRef<string | null>(null);
  const setDraft = React.useCallback((next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  // Render-phase updates below go through setDraftState (a ref cannot be
  // written during render); this brings the ref back in line before any
  // handler can run.
  useIsoLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  // Day that owns the roving tabindex inside the grid.
  const [focusDay, setFocusDay] = React.useState<Date | null>(null);
  // Measured after render: whether the popup flips above the field, the
  // horizontal offset (px) that keeps an in-tree popup inside the viewport,
  // and (when portaled) the fixed top/left in viewport coordinates plus the
  // height cap that keeps it between the field and the viewport edge.
  const [pos, setPos] = React.useState<{
    up: boolean;
    shift: number;
    top: number;
    left: number;
    maxHeight?: number;
  }>({
    up: false,
    shift: 0,
    top: 0,
    left: 0,
  });
  // DOM focus only follows focusDay after keyboard navigation — opening the
  // popup with the mouse must NOT steal focus from the text input.
  const keyboardNavRef = React.useRef(false);

  // The option (month index or year) holding the roving tabindex in the
  // months and years views; null means "the current one".
  const [rovingOption, setRovingOption] = React.useState<number | null>(null);
  // Where keyboard focus goes once a view switch has rendered (see
  // switchView). Set only when focus was already inside the popover, so a
  // mouse user's focus stays in the input.
  const pendingFocusRef = React.useRef<"grid" | "option" | null>(null);
  // True for the length of the second tap's own blur/focus pair, which
  // raises the on-screen keyboard and is not the visitor leaving the field.
  const refocusingRef = React.useRef(false);
  // The latest date committed from the widget's own UI, for an onBlur that
  // runs before the parent has re-rendered with it. Cleared once the value
  // changes, so it can never outlive the commit it stands for.
  const justCommittedRef = React.useRef<Date | undefined>(undefined);
  // True from the moment leaving the widget has been reported until focus
  // comes back into it, so leaving is never reported twice.
  const leftRef = React.useRef(false);
  // The most recent pointerdown inside the widget; see activationOf.
  const lastPointerRef = React.useRef<PointerNote | null>(null);
  // Disarms the pending post-pick click guard; see armClickGuard.
  const disarmClickGuardRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => disarmClickGuardRef.current?.(), []);
  // The latest render's handlers, for document listeners and deferred checks
  // that would otherwise run a stale closure.
  const latestRef = React.useRef({
    commitTyped: (): Date | undefined => undefined,
    leaveWidget: (): void => {},
  });

  // Touch only: has this visitor asked to type, by tapping the text a second
  // time while the calendar is open? Reset on every close, so the intent lasts
  // one interaction and the next tap starts from the grid again.
  const [typingIntent, setTypingIntent] = React.useState(false);

  // The flip decision (above/below the field) is frozen for as long as the
  // popover stays open — see the measure effect.
  const flipRef = React.useRef<boolean | null>(null);

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

  // Direction (prop `direction`, decision D19). An explicit or locale-derived
  // direction is stamped on the root; an inherited one is read from the
  // root's computed style when the popover is measured, because only layout
  // knows what an ancestor's dir (including dir="auto") resolved to.
  const localeDir = React.useMemo(
    () => localeDirection(resolvedLocale),
    [resolvedLocale],
  );
  const explicitDir =
    direction === "auto"
      ? localeDir
      : direction === "ltr" || direction === "rtl"
        ? direction
        : undefined;
  const [inheritedDir, setInheritedDir] = React.useState<"ltr" | "rtl">("ltr");
  const effectiveDir = explicitDir ?? inheritedDir;

  const weekStart = React.useMemo(
    () => firstDayOfWeek(resolvedLocale),
    [resolvedLocale],
  );
  // The numbering system every number in the widget is written in (D20).
  // The field is ASCII (dd.MM.yyyy), and so were the day numerals and the
  // year pill (getDate/getFullYear) — but the formatters followed the
  // locale's default, so under "ar" or "fa" the echo, the month title a
  // screen reader announces and the day names said ٢٠٢٦ next to a pill that
  // said 2026. Latin unless the locale tag asks for a system explicitly
  // (e.g. "ar-u-nu-arab"): then the formatters, the day numerals and the
  // years all use it. Only the typed field stays ASCII, as it must.
  const numbering = React.useMemo(() => {
    try {
      return new Intl.Locale(resolvedLocale).numberingSystem ?? null;
    } catch {
      return null;
    }
  }, [resolvedLocale]);
  const numberFmt = React.useMemo(
    () =>
      numbering
        ? new Intl.NumberFormat(resolvedLocale, { useGrouping: false })
        : null,
    [numbering, resolvedLocale],
  );
  const num = (n: number): string =>
    numberFmt ? numberFmt.format(n) : String(n);

  // The language every Intl string is in, for lang= on the echo and the
  // popover. Assistive tech otherwise pronounces a Ukrainian month name with
  // the page's English rules. Intl's resolved locale rather than the prop,
  // because an unknown tag formats in the host's default language.
  const langTag = React.useMemo(() => {
    try {
      return new Intl.Locale(
        new Intl.DateTimeFormat(resolvedLocale).resolvedOptions().locale,
      ).baseName;
    } catch {
      return undefined;
    }
  }, [resolvedLocale]);

  // First letter in title case, the rest exactly as Intl wrote it — CLDR's
  // "titlecase-firstword", its casing for menu items and for the start of a
  // sentence. This replaces CSS text-transform: capitalize, which upper-cased
  // every word: the Spanish echo "miércoles, 17 de junio de 2026" painted as
  // "Miércoles, 17 De Junio De 2026".
  const sentenceCase = (s: string): string => {
    const [first = "", ...rest] = Array.from(s);
    return titlecaseLetter(first, langTag) + rest.join("");
  };

  // calendar: "gregory" is pinned on every formatter so the long-form echo
  // and grid labels always describe the same Gregorian day the grid shows.
  // Without it, ar-SA defaults to islamic-umalqura and th-TH to the Buddhist
  // era, so a selection on the Gregorian grid echoed as a Hijri/Buddhist
  // date (docs/DECISIONS.md D11). Display calendars may become opt-in later;
  // the value type stays a Gregorian-interpreted local-midnight Date.
  const dateOpts = React.useMemo<Intl.DateTimeFormatOptions>(
    () =>
      numbering
        ? { calendar: "gregory" }
        : { calendar: "gregory", numberingSystem: "latn" },
    [numbering],
  );
  const monthTitleFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        ...dateOpts,
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale, dateOpts],
  );
  const monthLongFmt = React.useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { ...dateOpts, month: "long" }),
    [resolvedLocale, dateOpts],
  );
  const monthShortFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, { ...dateOpts, month: "short" }),
    [resolvedLocale, dateOpts],
  );
  const weekdayFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, { ...dateOpts, weekday: "short" }),
    [resolvedLocale, dateOpts],
  );
  // Column headers show the short weekday but are announced with the long
  // one, the role="columnheader" equivalent of the APG example's
  // <th abbr="Sunday">Su</th>.
  const weekdayLongFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, { ...dateOpts, weekday: "long" }),
    [resolvedLocale, dateOpts],
  );
  const fullDateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        ...dateOpts,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale, dateOpts],
  );
  // Day-cell accessible names must BEGIN with the day number so voice-control
  // commands like "click 18" match. fullDateFmt leads with the weekday in
  // most locales, which breaks that match (ROADMAP Track 5 defect). Build the
  // name explicitly: number first, then weekday/month/year from Intl parts.
  const dayNamePartsFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        ...dateOpts,
        weekday: "long",
        month: "long",
        year: "numeric",
      }),
    [resolvedLocale, dateOpts],
  );
  const dayNumberFmt = React.useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { ...dateOpts, day: "numeric" }),
    [resolvedLocale, dateOpts],
  );
  const formatDayAccessibleName = React.useCallback(
    (d: Date): string => {
      // Each part keeps the unit word Intl attaches to it directly — 2026年,
      // 1月, 31日 in Japanese and Chinese. Joining the bare parts dropped
      // them, and "31 土曜日 1 2026" no longer said which number was the
      // month. A literal that begins with a space is spacing or punctuation,
      // not a unit, and is still dropped.
      const withUnit = (parts: Intl.DateTimeFormatPart[], type: string) => {
        const i = parts.findIndex((p) => p.type === type);
        if (i < 0) return "";
        const next = parts[i + 1];
        const unit =
          next?.type === "literal" ? (next.value.match(/^\p{L}+/u)?.[0] ?? "") : "";
        return parts[i].value + unit;
      };
      const parts = dayNamePartsFmt.formatToParts(d);
      return [
        withUnit(dayNumberFmt.formatToParts(d), "day"),
        withUnit(parts, "weekday"),
        withUnit(parts, "month"),
        withUnit(parts, "year"),
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    },
    [dayNamePartsFmt, dayNumberFmt],
  );

  // Navigation bounds as month keys (year * 12 + month): minDate/maxDate when
  // given, and always the representable-date margin, so the clamp below and
  // every comparison against these can work on plain integers.
  const minMonth = Math.max(minDate ? monthKey(minDate) : -Infinity, SAFE_MIN_KEY);
  const maxMonth = Math.min(maxDate ? monthKey(maxDate) : Infinity, SAFE_MAX_KEY);
  const clampMonth = React.useCallback(
    (d: Date): Date => {
      const k = monthKey(d);
      // NaN only if a caller derived an unrepresentable month; land on the
      // nearest real bound rather than propagating an Invalid Date.
      const c = Number.isNaN(k) ? minMonth : Math.min(Math.max(k, minMonth), maxMonth);
      return monthFromKey(c);
    },
    [minMonth, maxMonth],
  );

  // The field is controlled: a new `value` from the parent wins over whatever
  // the visitor had typed but not committed, and an open grid moves to it.
  // Before, a parent reset (or any other setValue) left the old draft on
  // screen, and the next blur committed that draft straight back over the
  // parent's correction; an open grid kept showing the previous month, with
  // the roving day ready to commit the stale date on Enter. Derived during
  // render (React's documented pattern) so no frame shows the stale draft.
  const valueKey = value ? value.getTime() : null;
  const [seenValueKey, setSeenValueKey] = React.useState(valueKey);
  if (valueKey !== seenValueKey) {
    setSeenValueKey(valueKey);
    if (draft !== null) setDraftState(null);
    if (open && value) {
      setViewMonth(clampMonth(startOfDay(value)));
      setFocusDay(startOfDay(value));
    }
  }

  React.useEffect(() => {
    justCommittedRef.current = undefined;
  }, [valueKey]);

  // A field disabled while it holds an uncommitted draft drops it: a disabled
  // field shows its committed value, and the draft could otherwise still be
  // committed by the next Enter or blur.
  if (disabled && draft !== null) setDraftState(null);

  // `disabled` set while the calendar is open closes it: the day buttons on
  // screen would otherwise still be there to pick from. Derived here rather
  // than in an effect so no frame shows a pickable grid on a disabled field.
  // (The refs close() also resets are reset again by the next openPopup.)
  if (disabled && open) {
    setOpen(false);
    setView("days");
    setGridHelpShown(false);
    setTypingIntent(false);
  }

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

  // Whether shouldDisableDate allows at least one day of a month.
  const monthHasEnabledDay = (month: Date): boolean => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const days = ymd(y, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      if (!shouldDisableDate(ymd(y, m, d))) return true;
    }
    return false;
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
    let month = clampMonth(startOfDay(base));
    // With nothing chosen and no defaultCalendarMonth the grid opens on
    // today's month — and used to stop there even when every day in it was
    // disabled (a lead time that blanks the rest of the month), leaving a
    // keyboard user on a grid with nothing to pick. The documented chain is
    // defaultCalendarMonth, then today, then the first enabled month: walk
    // forward to it, within maxDate, for up to two years.
    if (!typed && !value && !defaultCalendarMonth) {
      let probe = month;
      for (let i = 0; i < 24 && !monthHasEnabledDay(probe); i++) {
        const next = clampMonth(ymd(probe.getFullYear(), probe.getMonth() + 1, 1));
        if (monthKey(next) === monthKey(probe)) break; // reached maxDate
        probe = next;
      }
      if (monthHasEnabledDay(probe)) month = probe;
    }
    setViewMonth(month);
    setFocusDay(typed ? startOfDay(typed) : value ? startOfDay(value) : null);
    setView("days");
    setRovingOption(null);
    justCommittedRef.current = undefined;
    keyboardNavRef.current = false;
    setGridHelpShown(false);
    // A fresh open re-decides which side to open toward; it stays frozen from
    // there until this popover closes.
    flipRef.current = null;
    setOpen(true);
  };

  const close = React.useCallback((refocus = false) => {
    setOpen(false);
    setView("days");
    keyboardNavRef.current = false;
    setGridHelpShown(false);
    flipRef.current = null;
    // Typing intent is per-interaction: the next tap on the field opens the
    // grid again rather than resuming with a keyboard the visitor did not ask
    // for a second time.
    setTypingIntent(false);
    if (refocus) inputRef.current?.focus();
  }, [setTypingIntent]);

  // Is this node part of the widget: the field side (the root) or the
  // popover, which a portal moves outside the root's DOM subtree. Duck-typed
  // so a node from another document (an iframe portal) is answered too.
  const insideWidget = React.useCallback((node: unknown): boolean => {
    if (!node || typeof (node as Node).nodeType !== "number") return false;
    return !!(
      rootRef.current?.contains(node as Node) ||
      popupRef.current?.contains(node as Node)
    );
  }, []);

  // Focus is on a control inside the popover. Closing then unmounts the
  // focused control, and an unmounted control fires no blur: leaving has to
  // be reported by whatever closes it.
  const focusInPopover = React.useCallback((): boolean => {
    const pop = popupRef.current;
    return !!pop && pop.contains(pop.ownerDocument.activeElement);
  }, []);

  // The documents the widget lives in. Usually one; two when the popover is
  // portaled into an iframe's document, where the visitor's presses and keys
  // then land — document-level listeners on the rendering document alone
  // never heard them, so Escape and an outside press there did nothing.
  const widgetDocuments = React.useCallback((): Document[] => {
    const docs = new Set<Document>();
    if (typeof document !== "undefined") docs.add(document);
    if (rootRef.current) docs.add(rootRef.current.ownerDocument);
    if (popupRef.current) docs.add(popupRef.current.ownerDocument);
    return Array.from(docs);
  }, []);

  // Outside interaction closes the popup. `mousedown` (not click) so the
  // popup is gone before any other control processes the press. When the
  // popover is portaled it is no longer a DOM descendant of the root, so
  // both containers are checked — a click on a day must not count as
  // "outside".
  React.useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (insideWidget(e.target)) return;
      // With focus inside the calendar, this press is the visitor leaving:
      // the calendar closes under the focused control, which then fires no
      // blur, so the parent used to hear no onBlur at all after ArrowDown
      // into the grid and a click elsewhere.
      if (focusInPopover()) {
        latestRef.current.leaveWidget();
        return;
      }
      // A press that only dismissed the calendar left a finished draft
      // uncommitted whenever the target did not take focus (empty page
      // chrome, a heading; any tap on iOS that does not blur the field): the
      // field showed one date and the value was another. Commit it here; the
      // blur that usually follows finds nothing left to commit.
      latestRef.current.commitTyped();
      close();
    };
    const docs = widgetDocuments();
    for (const doc of docs) {
      doc.addEventListener("mousedown", onDocDown);
      doc.addEventListener("touchstart", onDocDown);
    }
    return () => {
      for (const doc of docs) {
        doc.removeEventListener("mousedown", onDocDown);
        doc.removeEventListener("touchstart", onDocDown);
      }
    };
  }, [open, close, insideWidget, focusInPopover, widgetDocuments]);

  // Escape must close no matter where focus sits. Safari does not focus
  // buttons on click, so after tapping a calendar control the keydown fires
  // on <body> and an element-level handler would never see it.
  //
  // preventDefault marks the key as handled, so a surrounding native
  // <dialog> (whose cancel is Escape's default action) or a modal library
  // that checks defaultPrevented closes the calendar only, not itself.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const docs = widgetDocuments();
    for (const doc of docs) doc.addEventListener("keydown", onKey, true);
    return () => {
      for (const doc of docs) doc.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, widgetDocuments]);

  // form.reset() puts every native control back to its default. This one's
  // visible text is a React draft, which reset cannot see, so the typed text
  // stayed on screen over the unchanged value until the next blur committed
  // it. Dropping the draft on reset restores the committed value.
  React.useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setDraft(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [setDraft]);

  // Copy --rldp-* custom properties, color-scheme and the inherited
  // typography from the component root onto a portaled popover. Portaling
  // detaches the node from the root's inheritance chain, so without this an
  // ancestor theme (or a token set on a form card) would silently stop
  // applying to the calendar, and it would paint in the page's font instead
  // of the form's. Tokens that disappear from the root (a theme removed) are
  // removed again, and nothing is rewritten that has not changed.
  const copiedTokensRef = React.useRef<Set<string>>(new Set());
  const syncPortaledTheme = React.useCallback(() => {
    const root = rootRef.current;
    const pop = popupRef.current;
    const win = root?.ownerDocument.defaultView;
    if (!root || !pop || !win) return;
    const cs = win.getComputedStyle(root);
    const seen = new Set<string>();
    for (let i = 0; i < cs.length; i++) {
      const name = cs.item(i);
      if (!name.startsWith("--rldp")) continue;
      seen.add(name);
      const v = cs.getPropertyValue(name);
      if (pop.style.getPropertyValue(name) !== v) pop.style.setProperty(name, v);
    }
    for (const name of copiedTokensRef.current) {
      if (!seen.has(name)) pop.style.removeProperty(name);
    }
    copiedTokensRef.current = seen;
    for (const prop of [
      "color-scheme",
      "font-family",
      "line-height",
      "letter-spacing",
    ]) {
      const v = cs.getPropertyValue(prop);
      if (v && pop.style.getPropertyValue(prop) !== v) {
        pop.style.setProperty(prop, v);
      }
    }
  }, []);

  // Keep those copies live. A theme toggled while the calendar is open (a
  // .dark class on an ancestor, themeName, the OS scheme) used to leave a
  // portaled calendar on the colours copied when it opened. Changes inside
  // the popover itself are ignored: syncing writes there.
  React.useEffect(() => {
    if (!open || !usePortal) return;
    const root = rootRef.current;
    const doc = root?.ownerDocument;
    const win = doc?.defaultView;
    if (!root || !doc || !win) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        syncPortaledTheme();
      });
    };
    const Observer = (win as Window & typeof globalThis).MutationObserver;
    const observer = Observer
      ? new Observer((records) => {
          if (records.some((r) => !popupRef.current?.contains(r.target))) {
            schedule();
          }
        })
      : null;
    observer?.observe(doc.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: [
        "class",
        "style",
        "data-theme",
        "data-rldp-theme",
        "dir",
        "lang",
      ],
    });
    let scheme: MediaQueryList | null = null;
    try {
      scheme = win.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
    } catch {
      scheme = null;
    }
    scheme?.addEventListener?.("change", schedule);
    return () => {
      observer?.disconnect();
      scheme?.removeEventListener?.("change", schedule);
      if (frame) win.cancelAnimationFrame(frame);
    };
  }, [open, usePortal, syncPortaledTheme]);

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
      // The popover's natural height, even while a height cap below is
      // shortening it: content height plus its borders.
      const ph = pop.scrollHeight + (pop.offsetHeight - pop.clientHeight);
      const pw = pop.offsetWidth;
      const spaceBelow = window.innerHeight - r.bottom;
      // When neither side fits fully, open toward the roomier side; the page
      // can scroll to reveal the rest (in-tree) or the fixed coords place it
      // on the roomier side (portaled).
      //
      // Decided ONCE per open and then frozen. Re-deciding on every scroll and
      // resize is what made the calendar jump from under the field to over it
      // mid-interaction, and the on-screen keyboard triggers it every time: the
      // keyboard takes about half the viewport, `window.innerHeight` shrinks by
      // that much, `spaceBelow` collapses, and a calendar the visitor was
      // reading vaults over the field on the very frame their keyboard appears.
      // Reported from a live checkout in exactly those words — "the calendar
      // goes up and looks weird".
      //
      // Coordinates keep updating, so the popover still tracks the field
      // through scrolling and layout changes. Only the side is sticky, and only
      // until the popover closes.
      const fits = spaceBelow < ph + 8 && r.top > spaceBelow;
      const up = flipRef.current ?? fits;
      flipRef.current = up;
      // In a right-to-left layout the calendar opens from the field's start
      // edge, which is its right. It used to be placed by a physical left in
      // both directions, so in RTL it hung off the far end of a wide field.
      const rtl = explicitDir
        ? explicitDir === "rtl"
        : inheritedDirection(root) === "rtl";
      if (!explicitDir) setInheritedDir(rtl ? "rtl" : "ltr");
      const maxLeft = window.innerWidth - 8 - pw;
      if (usePortal) {
        let left = rtl ? r.right - pw : r.left;
        if (left > maxLeft) left = maxLeft;
        if (left < 8) left = 8;
        // Anchored to the field edge on its side, and never over the field:
        // when the space between that edge and the viewport is shorter than
        // the calendar, its height is capped and it scrolls inside. A fixed
        // box cannot be scrolled to, so a calendar that overflowed the
        // viewport (a flip above a field low on a short screen) lost the
        // month it opened to show; shifting it back inside instead slid it
        // over the field, which the on-screen keyboard causes whenever it
        // shrinks the page — the visitor then typed into a hidden field.
        //
        // The cap stops at MIN_CAPPED_HEIGHT. With the side frozen, scrolling
        // the field to the viewport edge takes the room to zero; a box cannot
        // be shorter than its own padding and border, so capped that far it
        // was an empty strip that sat on the field it was meant to clear.
        // Below the minimum the calendar keeps its height and runs past the
        // viewport edge with the field, as an in-flow popup does.
        const room = Math.floor(
          up ? r.top - 4 - 8 : window.innerHeight - 8 - (r.bottom + 4),
        );
        const cap = Math.max(room, MIN_CAPPED_HEIGHT);
        const maxHeight = ph > cap ? cap : undefined;
        const top = up ? r.top - 4 - Math.min(ph, cap) : r.bottom + 4;
        setPos((p) =>
          p.up === up &&
          p.top === top &&
          p.left === left &&
          p.shift === 0 &&
          p.maxHeight === maxHeight
            ? p
            : { up, shift: 0, top, left, maxHeight },
        );
        syncPortaledTheme();
      } else {
        let shift = rtl ? r.width - pw : 0;
        if (r.left + shift > maxLeft) shift = maxLeft - r.left;
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
    // A fixed popover has to follow the field on its own: scrolling (of the
    // page or of any container between the field and the viewport),
    // resizing, and every layout change that moves or grows the field — an
    // error message inserted above it, the echo appearing under it — which
    // fire no event at all. Scroll and resize listeners caught only the
    // first two, so the calendar detached from a field that moved.
    //
    // One getBoundingClientRect per frame while the calendar is open, and a
    // full measure (three forced layouts) only on frames where the field's
    // box or the viewport actually changed.
    let frame = 0;
    let last = "";
    const track = () => {
      frame = requestAnimationFrame(track);
      if (!popupRef.current) return;
      const r = root.getBoundingClientRect();
      const key = `${r.top} ${r.left} ${r.width} ${r.height} ${window.innerWidth} ${window.innerHeight}`;
      if (key === last) return;
      last = key;
      measure();
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [open, view, viewMonth, usePortal, syncPortaledTheme, explicitDir]);

  // Swallow the second click of an accidental double-click on a day: once the
  // popup unmounts it would land on whatever control renders underneath and
  // silently change it. Only that click is swallowed — one inside the
  // popover's last footprint, within 350ms of a pointer pick. The guard used
  // to cancel every click anywhere on the page (the next field, Submit, the
  // trigger itself), kept doing so after the picker unmounted, and stacked a
  // listener per pick.
  const armClickGuard = () => {
    disarmClickGuardRef.current?.();
    const pop = popupRef.current;
    const doc = pop?.ownerDocument;
    const win = doc?.defaultView;
    if (!pop || !doc || !win) return;
    const r = pop.getBoundingClientRect();
    const guard = (e: MouseEvent) => {
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const disarm = () => {
      doc.removeEventListener("click", guard, true);
      win.clearTimeout(timer);
      if (disarmClickGuardRef.current === disarm) {
        disarmClickGuardRef.current = null;
      }
    };
    doc.addEventListener("click", guard, true);
    const timer = win.setTimeout(disarm, 350);
    disarmClickGuardRef.current = disarm;
  };

  const commit = (date: Date, by: "keyboard" | "touch" | "mouse" = "keyboard") => {
    // `disabled` can arrive while the calendar is already on screen (a form
    // that disables the field when a prerequisite changes). The day click and
    // the grid's Enter/Space all land here, so one check covers them.
    if (disabled) return;
    const d = startOfDay(date);
    justCommittedRef.current = d;
    onChange(d);
    setDraft(null);
    if (by !== "keyboard") armClickGuard();
    // Return focus to the input for anyone who arrived by keyboard — APG says
    // a dialog hands focus back to the control that opened it, and without it
    // a keyboard user is dropped onto <body> mid-form.
    //
    // But NOT for a finger. On touch, focusing a text input is a request for
    // the on-screen keyboard, and this path runs on the tap that PICKED a day
    // and closed the calendar — a visitor who used the grid precisely so they
    // would not have to type got the keyboard anyway, over the form they were
    // trying to see. Reported from a live checkout. A mouse is unaffected:
    // there is no virtual keyboard to raise, and the focus return is free.
    //
    // A finger pick made while focus is inside the calendar (a visitor who
    // arrowed into the grid and then tapped a day) leaves focus on nothing
    // once the calendar closes. That is leaving the widget, so the parent
    // hears onBlur with the picked date. A tap does not move focus there by
    // itself: the popover cancels mousedown, so focus is normally still in
    // the field and nothing is reported until it leaves.
    if (by === "touch" && focusInPopover()) {
      latestRef.current.leaveWidget();
      return;
    }
    close(by !== "touch");
  };

  // IME composition in progress, and the text shown when it began.
  const composingRef = React.useRef(false);
  const composeBaseRef = React.useRef("");

  // Turn what the visitor typed into the field's next text (see
  // nextTypedText) and follow it in the open calendar.
  const applyTyped = (raw: string, prev: string) => {
    const next = nextTypedText(prev, raw);
    // An edit the mask throws away entirely (a letter, a stray separator)
    // leaves the visible text as it was. It must not create a draft either:
    // a draft is what blur commits, and committing text the visitor did not
    // change rewrote the stored value or reported an error for a date that
    // was already on screen.
    if (draftRef.current === null && next === formatDisplay(value)) return;
    setDraft(next);
    // Follow the typing in the open calendar: once the draft names a complete
    // date, navigate the grid to it and hand it the roving target. DOM focus
    // stays in the input (keyboardNavRef is untouched) so typing is never
    // interrupted, and clampMonth keeps the min/max navigation bounds
    // authoritative. Partial drafts do not navigate — guessing the year wrong
    // and yanking the view around mid-entry is worse than waiting.
    if (open) {
      const parsed = parseTyped(next);
      if (parsed) {
        setViewMonth(clampMonth(startOfDay(parsed)));
        setFocusDay(startOfDay(parsed));
      }
    }
  };

  // Returns the newly committed Date, or undefined when nothing changed —
  // the blur handler forwards the effective value to the parent.
  //
  // Reads the draft from draftRef, so a second call in the same event (an
  // outside press, then the blur it causes) is a no-op rather than a second
  // commit or a second report.
  const commitTyped = (): Date | undefined => {
    const typed = draftRef.current;
    if (typed === null) return undefined;
    // A field disabled since the draft was typed takes no commit from it;
    // the draft is dropped back to the committed value.
    if (disabled) {
      setDraft(null);
      return undefined;
    }
    if (typed.trim() === "") {
      // Field cleared by typing: keep the previous committed value and just
      // resync the text. Typing never commits null — a parent that supports
      // clearing does it from outside through value/onChange.
      setDraft(null);
      // "missing" means the field is left empty. With a committed value the
      // resync puts that value straight back, so reporting "missing" would
      // put an error beside a date that is still there.
      if (value === null) onValidationError?.("missing");
      return undefined;
    }
    const parsed = parseTyped(typed);
    if (!parsed) {
      setDraft(null); // invalid input reverts to the committed value
      onValidationError?.("impossible-date");
      return undefined;
    }
    // Evaluated before the draft is cleared: a predicate that throws must
    // leave the visitor's text on screen, not wipe it and then fail.
    const rejected = shouldDisableDate(parsed);
    setDraft(null);
    if (rejected) {
      onValidationError?.("not-selectable");
      return undefined;
    }
    const d = startOfDay(parsed);
    justCommittedRef.current = d;
    onChange(d);
    return d;
  };

  // Focus has left the widget — field and popover both. This, not the
  // input's own blur, is when the draft is committed and the parent hears
  // onBlur. The input's blur used to do both, so moving INTO the picker (the
  // second tap that raises the keyboard, ArrowDown into the grid, Tab into the
  // header) committed or wiped a half-typed date and fired the parent's
  // validation mid-interaction — the false-"required" flash the onBlur
  // contract exists to prevent. Leaving also closes the calendar, which
  // otherwise stayed open over whatever the keyboard had moved on to.
  //
  // finally: a shouldDisableDate (or onChange) that throws inside commitTyped
  // must not also cost the parent its blur.
  const leaveWidget = () => {
    let committed: Date | undefined;
    try {
      committed = commitTyped();
    } finally {
      if (open) close();
      const pending = justCommittedRef.current;
      justCommittedRef.current = undefined;
      leftRef.current = true;
      onBlur?.(committed ?? pending ?? value);
    }
  };

  useIsoLayoutEffect(() => {
    latestRef.current = { commitTyped, leaveWidget };
  });

  // React delivers blur from every descendant here, including a portaled
  // popover (synthetic events follow the React tree, not the DOM tree).
  const onWidgetBlur = (e: React.FocusEvent) => {
    if (refocusingRef.current) return;
    if (leftRef.current) return;
    if (insideWidget(e.relatedTarget)) return;
    const target = e.target as HTMLElement;
    if (e.relatedTarget || target === inputRef.current) {
      leaveWidget();
      return;
    }
    // A popover control lost focus with no destination. Either the visitor
    // left for the page itself, or a re-render unmounted the focused control
    // (a shorter month dropping a row) and the view effects re-place focus.
    // Decide once that has settled: a control that is gone was ours.
    const doc = target.ownerDocument;
    queueMicrotask(() => {
      if (!target.isConnected) return;
      if (leftRef.current) return;
      if (insideWidget(doc.activeElement)) return;
      latestRef.current.leaveWidget();
    });
  };

  // --- Days grid model -----------------------------------------------------
  const daysGrid = React.useMemo(() => {
    const first = ymd(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = ymd(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    ).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(ymd(viewMonth.getFullYear(), viewMonth.getMonth(), d));
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
      const day = ymd(2024, 5, 2 + ((weekStart + i) % 7));
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
  //
  // Recomputed every render: it reads shouldDisableDate and today, which an
  // open calendar can see change (availability arriving after the calendar
  // opened). A memo keyed only on the grid kept the tab stop on the old
  // predicate's answer, so no enabled day had tabindex 0 once the real rules
  // arrived. It costs at most 42 predicate calls, as the grid itself does.
  const roveTarget = ((): Date | null => {
    const inView = (d: Date | null) =>
      !!d && monthKey(d) === monthKey(viewMonth);
    if (focusDay && inView(focusDay)) return focusDay;
    if (value && inView(value)) return startOfDay(value);
    if (inView(today) && !shouldDisableDate(today)) return today;
    for (const d of daysGrid) {
      if (d && !shouldDisableDate(d)) return d;
    }
    // Nothing selectable in this month. Keep a tab stop anyway (disabled days
    // stay focusable), so a keyboard user can get in and page to a month
    // that has something to pick.
    for (const d of daysGrid) {
      if (d) return d;
    }
    return null;
  })();

  const canPrevMonth = monthKey(viewMonth) > minMonth;
  const canNextMonth = monthKey(viewMonth) < maxMonth;

  // Live, for the key handlers: the computed direction, so an ancestor's
  // dir="auto" counts (the element's own .dir property only says "auto").
  const isRTL = (): boolean => {
    if (explicitDir) return explicitDir === "rtl";
    const root = rootRef.current;
    return !!root && inheritedDirection(root) === "rtl";
  };

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
    const target = ymd(d.getFullYear(), d.getMonth() + delta, 1);
    const last = ymd(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();
    return ymd(
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
        next = ymd(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - horiz,
        );
        break;
      case "ArrowRight":
        next = ymd(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() + horiz,
        );
        break;
      case "ArrowUp":
        next = ymd(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - 7,
        );
        break;
      case "ArrowDown":
        next = ymd(
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
        next = ymd(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - dist,
        );
        break;
      }
      case "End": {
        // End of the locale week containing `base`.
        const dist = (base.getDay() - weekStart + 7) % 7;
        next = ymd(
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
          commit(focusDay, "keyboard");
        } else {
          e.preventDefault(); // disabled day: swallow, keep dialog open
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    const k = monthKey(next);
    // Written as a positive range test so a NaN key (a step past the
    // representable range) is rejected too.
    if (!(k >= minMonth && k <= maxMonth)) return;
    keyboardNavRef.current = true;
    setFocusDay(next);
    if (k !== monthKey(viewMonth)) {
      setViewMonth(ymd(next.getFullYear(), next.getMonth(), 1));
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

  // Finish a view switch started by switchView: put keyboard focus into the
  // view that just rendered.
  React.useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || !open) return;
    pendingFocusRef.current = null;
    const pop = popupRef.current;
    if (!pop) return;
    if (pending === "grid") {
      keyboardNavRef.current = true;
      pop.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus();
    } else {
      pop
        .querySelector<HTMLElement>(
          '[data-part="month"][tabindex="0"],[data-part="year"][tabindex="0"]',
        )
        ?.focus();
    }
  }, [view, open]);

  // The year span runs a century-plus back by default, so the years grid
  // must bring the current view year into sight when it opens — otherwise
  // the list opens at the oldest year and the user scrolls for decades.
  //
  // The list itself is scrolled, not the current year scrolled into view:
  // scrollIntoView moves every scrollable ancestor too, so opening the year
  // list on a long form (a birth date, typically) jumped the whole page to
  // centre one button and took the field off screen.
  React.useEffect(() => {
    if (view !== "years") return;
    const list = popupRef.current?.querySelector<HTMLElement>(
      '[data-part="years"]',
    );
    const el = list?.querySelector<HTMLElement>(
      '[data-part="year"][data-current]',
    );
    if (!list || !el) return;
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    list.scrollTop += er.top - lr.top - (list.clientHeight - er.height) / 2;
  }, [view]);

  // --- Months / years grids ------------------------------------------------
  const yearNow = today.getFullYear();
  const viewYear = viewMonth.getFullYear();
  // At most MAX_YEAR_OPTIONS numbers; recomputed per render, which is cheaper
  // than proving to the compiler that `today` is never mutated.
  const yearsRange = ((): number[] => {
    // Without an explicit minDate the year grid used to start at the
    // CURRENT year, which quietly made past years unreachable through the
    // year view — hostile to the birth-date use case, where a 1967 entry
    // is routine, and the kind of gap users read as "the app does not
    // allow earlier dates". 120 years back is the span birth-date
    // dropdowns conventionally offer. Month navigation and typed entry
    // were never limited; this widens only the year GRID. Selection
    // stays governed solely by shouldDisableDate either way.
    let from = minDate ? minDate.getFullYear() : yearNow - 120;
    let to = maxDate ? maxDate.getFullYear() : yearNow + 2;
    // The open year is always in its own list. A value (or
    // defaultCalendarMonth) outside the default window used to leave the
    // year pill naming a year the list did not contain, with nothing marked
    // current and nothing for the open-scroll to bring into view. Explicit
    // bounds already contain it: the view is clamped to them.
    if (!minDate) from = Math.min(from, viewYear);
    if (!maxDate) to = Math.max(to, viewYear);
    // One button per year: bounds centuries apart would otherwise render
    // thousands of them. Keep a window around the open year instead.
    if (to - from + 1 > MAX_YEAR_OPTIONS) {
      let start = Math.max(from, viewYear - MAX_YEAR_OPTIONS / 2);
      let end = start + MAX_YEAR_OPTIONS - 1;
      if (end > to) {
        end = to;
        start = to - MAX_YEAR_OPTIONS + 1;
      }
      from = start;
      to = end;
    }
    const years: number[] = [];
    for (let y = from; y <= to; y++) years.push(y);
    return years;
  })();
  const yearMin = yearsRange[0];
  const yearMax = yearsRange[yearsRange.length - 1];

  const monthEnabled = (year: number, month: number): boolean => {
    const k = year * 12 + month;
    return k >= minMonth && k <= maxMonth;
  };

  const inputText = draft !== null ? draft : formatDisplay(value);
  const prevMonthDate = ymd(
    viewMonth.getFullYear(),
    viewMonth.getMonth() - 1,
    1,
  );
  const nextMonthDate = ymd(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    1,
  );

  // Header chevrons: in days view they step months; in months view they
  // step YEARS (clamped to the year range, labelled with the year).
  //
  // The keyboard cursor moves with the view. Day buttons are reused across
  // months (keyed by position), so a focused day stayed focused while it
  // showed a different date, and Enter or the next arrow still acted on the
  // previous month's date. The cursor now steps by the same number of
  // months, and DOM focus follows it when it was in the grid.
  const stepView = (deltaMonths: number) => {
    const target = clampMonth(
      ymd(viewMonth.getFullYear(), viewMonth.getMonth() + deltaMonths, 1),
    );
    const moved = monthKey(target) - monthKey(viewMonth);
    if (moved === 0) return;
    setViewMonth(target);
    if (focusDay) setFocusDay(addCalendarMonths(focusDay, moved));
    const doc = popupRef.current?.ownerDocument;
    if (doc && gridRef.current?.contains(doc.activeElement)) {
      keyboardNavRef.current = true;
    }
  };
  const headerPrev = () => stepView(view === "months" ? -12 : -1);
  const headerNext = () => stepView(view === "months" ? 12 : 1);

  // Switching views unmounts the view that held focus. When focus was inside
  // the popover (a keyboard user's day or option), it is parked on the
  // control that triggered the switch — which survives it — and moved into
  // the new view once that has rendered. Focus used to fall to <body> with
  // the calendar still open. A pointer press leaves focus where it was: in
  // the field, so typing is never interrupted.
  const switchView = (
    next: "days" | "months" | "years",
    via: HTMLElement | null,
  ) => {
    const doc = popupRef.current?.ownerDocument;
    const active = doc?.activeElement ?? null;
    const fromInside = !!active && !!popupRef.current?.contains(active);
    if (fromInside && via && active !== via) via.focus();
    setRovingOption(null);
    setView(next);
    if (fromInside) pendingFocusRef.current = next === "days" ? "grid" : "option";
  };
  const pillOf = (part: "month-pill" | "year-pill") =>
    popupRef.current?.querySelector<HTMLElement>(`[data-part="${part}"]`) ??
    null;

  // Second ArrowDown from the field: into whichever view is showing.
  const moveFocusIntoView = () => {
    if (view === "days") {
      if (roveTarget) focusGridDay(roveTarget);
      return;
    }
    popupRef.current
      ?.querySelector<HTMLElement>(
        '[data-part="month"][tabindex="0"],[data-part="year"][tabindex="0"]',
      )
      ?.focus();
  };

  // Arrow keys among the month or year options, on the days grid's model:
  // one tab stop, arrows move it (three columns), Home/End jump to the ends,
  // PageUp/PageDown move a page — a year of months, or twelve years. Every
  // option used to be its own tab stop, so with the year list running a
  // century back, reaching 1967 from 2026 took sixty Tab presses.
  const onOptionsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const from = buttons.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    if (view === "months" && (e.key === "PageUp" || e.key === "PageDown")) {
      e.preventDefault();
      stepView(e.key === "PageUp" ? -12 : 12);
      return;
    }
    const horiz = isRTL() ? -1 : 1;
    let next: number;
    let step: number;
    switch (e.key) {
      case "ArrowLeft":
        step = -horiz;
        next = from + step;
        break;
      case "ArrowRight":
        step = horiz;
        next = from + step;
        break;
      case "ArrowUp":
        step = -3;
        next = from + step;
        break;
      case "ArrowDown":
        step = 3;
        next = from + step;
        break;
      case "PageUp":
        step = -12;
        next = Math.max(0, from + step);
        break;
      case "PageDown":
        step = 12;
        next = Math.min(buttons.length - 1, from + step);
        break;
      case "Home":
        step = 1;
        next = 0;
        break;
      case "End":
        step = -1;
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    // Months outside minDate/maxDate are disabled and cannot take focus;
    // keep moving in the same direction past them.
    while (next >= 0 && next < buttons.length && buttons[next].disabled) {
      next += step;
    }
    if (next < 0 || next >= buttons.length || next === from) return;
    buttons[next].focus();
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
      ? num(viewYear - 1)
      : monthTitleFmt.format(prevMonthDate));
  const headerNextLabel =
    labelText.nextMonth ??
    (view === "months"
      ? num(viewYear + 1)
      : monthTitleFmt.format(nextMonthDate));

  // The trigger restates the committed value, so a screen-reader user who
  // tabs past the field hears what is in it without opening the calendar.
  // It was aria-hidden before, which made it unreachable and unnamed; it
  // stays out of the tab order (tabIndex -1), because the input is the tab
  // stop and the parity contract keeps focus there.
  //
  // It carries the field's aria-label too. Two date fields used to expose
  // triggers that were both just "Open calendar", with nothing saying which
  // field each one belonged to.
  const triggerAction = open
    ? labelText.closeCalendar
    : value
      ? `${labelText.changeDate}, ${fullDateFmt.format(value)}`
      : labelText.openCalendar;
  const triggerLabel = ariaLabel ? `${ariaLabel}, ${triggerAction}` : triggerAction;

  // Popover tree — built outside the return so createPortal is a plain
  // expression (not an IIFE), which keeps the react-hooks ref linter happy
  // about event handlers that close over commit/close.
  const popoverTree = !open ? null : (
            <div
              ref={popupRef}
              dir={effectiveDir}
              lang={langTag}
              role="dialog"
              id={dialogId}
              // Named by the consumer's field label when there is one, and
              // otherwise by the month and year it shows. Without an
              // aria-label prop the dialog used to have no name at all.
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : titleId}
              // Keep focus in the input while clicking inside the popup: a
              // mousedown blur would run the parent's validation against a
              // still-empty field and flash a false error.
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName !== "INPUT") {
                  e.preventDefault();
                }
              }}
              // A portaled popover is not where the field is in the document,
              // so Tab out of its last control or Shift+Tab out of its first
              // is routed back to field order by hand. In-tree, the DOM order
              // is already right.
              onKeyDown={(e) => {
                if (e.key !== "Tab" || !usePortal) return;
                const items = focusablesIn(popupRef.current);
                if (items.length === 0) return;
                if (e.shiftKey && e.target === items[0]) {
                  e.preventDefault();
                  inputRef.current?.focus();
                } else if (!e.shiftKey && e.target === items[items.length - 1]) {
                  const next = nextFocusableAfter(rootRef.current, (el) =>
                    insideWidget(el),
                  );
                  if (next) {
                    e.preventDefault();
                    next.focus();
                  }
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
                      maxHeight: pos.maxHeight,
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
                // The built-in help is English (labels are the consumer's
                // to translate); it must not be read with the popover's lang.
                lang={labels?.keyboardHelp ? undefined : "en"}
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
                    id={titleId}
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
                    onClick={(e) =>
                      switchView(
                        view === "months" ? "days" : "months",
                        e.currentTarget,
                      )
                    }
                  >
                    {sentenceCase(monthLongFmt.format(viewMonth))}
                    {icons?.chevronDown ?? (
                      <ChevronDown {...slotProps("caret", "rldp-caret")} />
                    )}
                  </button>
                  <button
                    type="button"
                    {...slotProps("yearPill", "rldp-pill")}
                    data-active={view === "years" || undefined}
                    aria-expanded={view === "years"}
                    onClick={(e) =>
                      switchView(
                        view === "years" ? "days" : "years",
                        e.currentTarget,
                      )
                    }
                  >
                    {num(viewYear)}
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
                                onClick={(e) => {
                                  if (!isDisabled) commit(d, activationOf(e, lastPointerRef.current));
                                }}
                                onFocus={() => setFocusDay(d)}
                              >
                                {num(d.getDate())}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Months. One tab stop with arrow keys among the options
                  (onOptionsKeyDown). The open month is marked with
                  aria-current as well as data-current: the accent fill was
                  the only thing that said which one was open, and a screen
                  reader heard twelve month names and no current one. */}
              {view === "months" && (
                <div
                  {...slotProps("months", "rldp-months")}
                  onKeyDown={onOptionsKeyDown}
                >
                  {Array.from({ length: 12 }, (_, m) => {
                    const enabled = monthEnabled(viewYear, m);
                    const isCurrent = m === viewMonth.getMonth();
                    const isRove = m === (rovingOption ?? viewMonth.getMonth());
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!enabled}
                        tabIndex={isRove ? 0 : -1}
                        aria-label={sentenceCase(
                          monthLongFmt.format(ymd(viewYear, m, 15)),
                        )}
                        aria-current={isCurrent ? "true" : undefined}
                        {...slotProps(
                          "month",
                          "rldp-month",
                          isCurrent && "monthCurrent",
                        )}
                        data-current={isCurrent || undefined}
                        onFocus={() => setRovingOption(m)}
                        onClick={() => {
                          setViewMonth(clampMonth(ymd(viewYear, m, 1)));
                          switchView("days", pillOf("month-pill"));
                        }}
                      >
                        {sentenceCase(monthShortFmt.format(ymd(viewYear, m, 15)))}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Years — same model as the months. */}
              {view === "years" && (
                <div
                  {...slotProps("years", "rldp-years")}
                  onKeyDown={onOptionsKeyDown}
                >
                  {yearsRange.map((y) => {
                    const isCurrent = y === viewYear;
                    const isRove = y === (rovingOption ?? viewYear);
                    return (
                      <button
                        key={y}
                        type="button"
                        tabIndex={isRove ? 0 : -1}
                        aria-current={isCurrent ? "true" : undefined}
                        {...slotProps(
                          "year",
                          "rldp-year",
                          isCurrent && "yearCurrent",
                        )}
                        data-current={isCurrent || undefined}
                        onFocus={() => setRovingOption(y)}
                        onClick={() => {
                          setViewMonth(
                            clampMonth(ymd(y, viewMonth.getMonth(), 1)),
                          );
                          switchView("months", pillOf("year-pill"));
                        }}
                      >
                        {num(y)}
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
      dir={explicitDir}
      data-rldp-theme={themeName}
      {...slotProps("root", cx("rldp-root", className))}
      onFocus={() => {
        leftRef.current = false;
      }}
      onBlur={onWidgetBlur}
      onPointerDown={(e) => {
        lastPointerRef.current = { type: e.pointerType, at: e.timeStamp };
      }}
    >
      <div
        {...slotProps("field", "rldp-field")}
        data-error={hasError || undefined}
        data-disabled={disabled || undefined}
        onMouseDown={(e) => {
          // The padding inside the field's border is part of the visible
          // control. A press there used to land on this div and do nothing;
          // it now acts like a press on the text.
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          inputRef.current?.focus();
          if (!open) openPopup();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          /**
           * `none` suppresses the on-screen keyboard without making the field
           * read-only: the value stays selectable, a hardware keyboard still
           * types into it, and every a11y affordance is unchanged. It is the
           * one property that separates "focused" from "keyboard on screen",
           * which is the whole distinction this behaviour needs.
           *
           * Suppressed for EVERY visitor, not only the ones a media query calls
           * touch — because on a device with a physical keyboard the attribute
           * does nothing at all. Nobody on a desktop can tell it is set: they
           * click the field and type, exactly as before. That is what lets this
           * render identically on the server and the client, which is the whole
           * ballgame here — the very first tap is the one that must not raise a
           * keyboard, and anything decided after mount is decided too late.
           * An earlier attempt read the pointer through `useSyncExternalStore`
           * and measured correct in every test, while on the actual page the
           * attribute stayed `numeric` until something else re-rendered — i.e.
           * through the entire first tap.
           */
          inputMode={
            manualEntryOnTouch === "second-tap" && !typingIntent
              ? "none"
              : "numeric"
          }
          autoComplete="off"
          {...slotProps("input", "rldp-input")}
          value={inputText}
          placeholder={placeholder}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          id={id}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          // aria-expanded is not allowed on a textbox (axe:
          // aria-allowed-attr), so the open state lives on the trigger,
          // which is a button. aria-haspopup and aria-controls are allowed
          // here and still tie the field to the dialog it opens.
          aria-haspopup="dialog"
          aria-controls={open ? dialogId : undefined}
          onClick={(e) => {
            if (!open) {
              openPopup();
              return;
            }
            /**
             * Calendar already open and the visitor tapped the text itself —
             * not the trigger, not a day. On touch that is the second tap, and
             * the only unambiguous signal that they want to type rather than
             * pick. Raise the keyboard for them.
             *
             * `inputMode` alone does not do it: the field is already focused,
             * and browsers decide what keyboard to show when focus arrives, so
             * flipping the attribute under a focused input changes nothing
             * until focus is taken away and given back.
             *
             * Both halves have to happen inside this handler, which is what
             * `flushSync` buys. iOS Safari only honours a programmatic
             * `focus()` while it is still processing the gesture that caused
             * it; deferring the blur/focus pair to a `requestAnimationFrame`
             * leaves that window and Safari silently declines to raise the
             * keyboard — the tap does nothing, which is worse than the bug
             * being fixed. And the order cannot be relaxed either: React must
             * have committed `inputMode="numeric"` to the DOM before focus
             * returns, or the browser re-reads `none` and shows nothing.
             */
            if (
              activationOf(e, lastPointerRef.current) === "touch" &&
              manualEntryOnTouch === "second-tap" &&
              !typingIntent
            ) {
              flushSync(() => setTypingIntent(true));
              const el = inputRef.current;
              if (el) {
                // This blur is the field handing focus to itself, not the
                // visitor leaving: it must not commit or wipe the draft.
                refocusingRef.current = true;
                try {
                  el.blur();
                  el.focus();
                } finally {
                  refocusingRef.current = false;
                }
              }
            }
          }}
          onChange={(e) => {
            if (disabled) return;
            // Mid-composition text is provisional (an IME's candidate, not a
            // digit yet). Masking it would delete it under the IME and lose
            // the confirm; it is shown as-is and masked at compositionend.
            if (
              composingRef.current ||
              (e.nativeEvent as InputEvent).isComposing
            ) {
              setDraft(e.target.value);
              return;
            }
            applyTyped(e.target.value, inputText);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
            composeBaseRef.current = inputText;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            if (disabled) return;
            applyTyped(e.currentTarget.value, composeBaseRef.current);
          }}
          onKeyDown={(e) => {
            // Enter (or an arrow) that confirms an IME candidate belongs to
            // the IME; acting on it committed the half-composed text.
            if (composingRef.current || e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              // Enter in a closed field with nothing typed is the form's
              // Enter, as on any text input: it submits. Swallowing it
              // unconditionally meant a form whose submit is Enter never
              // submitted from this field. While the calendar is open or a
              // typed date is waiting, Enter confirms that instead —
              // submitting then would read the parent's pre-commit state.
              if (!open && draftRef.current === null) return;
              e.preventDefault();
              commitTyped();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              // Second ArrowDown moves the keyboard into the open view —
              // the days grid, or the month or year options when one of
              // those is showing (it used to look only for a day and, in
              // those views, swallowed the key and did nothing).
              if (!open) openPopup();
              else moveFocusIntoView();
            } else if (e.key === "Tab" && open) {
              // The calendar is entered with ArrowDown, like a combobox's
              // popup, and Tab from the field moves on to the next field as
              // in any form. Before, Tab walked into an in-tree calendar
              // (it is next in document order) while a portaled one was
              // skipped and left open over whatever received focus. Closing
              // synchronously makes the browser's own Tab navigation run
              // against the closed DOM; the blur that follows commits the
              // draft and tells the parent, as leaving always does.
              flushSync(() => close());
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          // aria-disabled, not disabled: a disabled <button> receives no
          // mouse events in Chromium, so a press on the calendar icon of a
          // disabled picker never reached openPopup and
          // onDisabledOpenAttempt was never called — the silent failure the
          // callback exists to prevent. openPopup refuses on its own.
          aria-disabled={disabled || undefined}
          {...slotProps("trigger", "rldp-trigger")}
          onMouseDown={(e) => {
            // Runs before the document mousedown-close listener would; toggle
            // without letting the input blur first.
            e.preventDefault();
            if (open) {
              // Closing from here hands focus back to the field when it was
              // inside the popover (a keyboard user's roving day): unmounting
              // the focused day otherwise dropped focus on <body>.
              const doc = popupRef.current?.ownerDocument;
              close(!!doc && !!popupRef.current?.contains(doc.activeElement));
            } else openPopup();
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
        // aria-hidden: the echo is a visual check against day/month
        // transposition, and for assistive tech it is redundant — the
        // trigger's name already says "Change date, <the date in words>". As
        // visible text it was also swallowed into the name of any <label>
        // wrapping the picker ("Start date Wednesday 17 June 2026").
        <p {...slotProps("echo", "rldp-echo")} lang={langTag} aria-hidden="true">
          {sentenceCase(fullDateFmt.format(value))}
        </p>
      )}

      {portaledPopover}
    </div>
  );
};
