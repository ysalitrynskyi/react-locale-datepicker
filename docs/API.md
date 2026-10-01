# Public API

The published contract of `react-locale-datepicker`. Every prop, export and
behaviour on this page is covered by the unit suite or the Playwright matrix;
changing one is a breaking change unless it is called out as an accessibility
correction in the changelog (see [`ROADMAP.md`](ROADMAP.md) § Principles).

## Component

```tsx
import { LocaleDatePicker } from "react-locale-datepicker";
import "react-locale-datepicker/styles.css"; // optional: omit to go unstyled

<LocaleDatePicker
  value={date}
  onChange={setDate}
  locale="de"
  placeholder="dd.mm.yyyy"
  aria-label="Start date"
/>;
```

## Props

### Required

| Prop | Type | Notes |
|---|---|---|
| `value` | `Date \| null` | **Local-midnight `Date`.** See § Timezone contract. An unusable Date (Invalid, outside the representable range, or not a Date at all) is treated as `null`. A Date from another realm (an iframe) is accepted. |
| `onChange` | `(date: Date \| null) => void` | Fires on commit — a day pick, Enter, or focus leaving the widget with a typed date — never on every keystroke. Typing never commits `null`. |
| `placeholder` | `string` | Required, and not derived from the locale: the display format is fixed (`dd.MM.yyyy`) and the component does not translate hint text, so the caller supplies a hint in its own language. Pass `""` for none. |

### Localization

| Prop | Type | Default | Notes |
|---|---|---|---|
| `locale` | `string` | `"en"` | Any BCP 47 tag `Intl` accepts. Normalized by `resolveLocale` (§ Locale resolution). A `-u-nu-` extension (e.g. `"ar-u-nu-arab"`) switches every number the widget renders to that numbering system (§ Numerals). |
| `direction` | `"ltr" \| "rtl" \| "auto"` | inherit | Omitted: inherit the page's direction from the nearest ancestor. `"auto"`: derive it from `locale`. `"ltr"`/`"rtl"`: explicit. Whichever applies is stamped on the popover too, so a portaled calendar keeps it. See D19. |
| `labels` | `Partial<Labels>` | English | The few strings `Intl` cannot supply. See § `labels`. |

### Constraints

| Prop | Type | Notes |
|---|---|---|
| `shouldDisableDate` | `(date: Date) => boolean` | **The single authority on selectability.** `minDate` and `maxDate` limit navigation only. A rejected day stays focusable (`aria-disabled`) so arrow keys never dead-end. |
| `minDate` | `Date \| null` | Bounds month and year navigation and the year list. |
| `maxDate` | `Date \| null` | Bounds month and year navigation and the year list. |
| `defaultCalendarMonth` | `Date \| null` | Month shown when opening with nothing typed or committed. Without it the calendar opens on today's month, or — when every day in it is disabled — on the first later month with a selectable day (up to two years ahead, within `maxDate`). |
| `today` | `Date` | Overrides what counts as "today" (ring, default view, keyboard target, year list). Wins over `timeZone`. For deterministic tests, and for rules not anchored to wall clocks. |
| `timeZone` | `string` | IANA zone "today" is derived in — for availability rules on a fixed business calendar day. `"default"`/`"system"` mean the visitor's zone; invalid names fall back to it. **Never converts the value** — the timezone contract below is untouched. See D16 and the exported `todayInTimeZone`. |

Keeping `shouldDisableDate` authoritative rather than deriving it from
`minDate`/`maxDate` is deliberate. Real forms disable scattered sets — weekends,
blackout ranges, a minimum lead time — that a range cannot express.

Without `minDate` the year list starts 120 years back, and without `maxDate`
it ends 2 years ahead; each bound replaces its own end. The list always
contains the open year, and with bounds centuries apart it is windowed to 600
options around the open year.

### State, events and validation

| Prop | Type | Notes |
|---|---|---|
| `disabled` | `boolean` | The field is read-only and nothing commits. Turning it on while the calendar is open closes it and drops an uncommitted typed date. |
| `hasError` | `boolean` | Visual only. The component never decides validity. |
| `onBlur` | `(current: Date \| null) => void` | Fires once when focus **leaves the widget** (field and calendar together), with the just-committed value — including when the calendar closes under a focused control and leaves focus on nothing (a press outside, or a finger pick, while focus is inside the calendar). See § Blur ordering. |
| `onDisabledOpenAttempt` | `() => void` | Fires when a user tries to open a disabled picker (a press on the field, its padding or the calendar icon, or ArrowDown in the field), so the form can point them at the field they must fill first. |
| `onValidationError` | `(reason: ValidationErrorReason) => void` | Reports why a **typed** entry did not commit. The component classifies and reports; the consumer renders. Never fires for calendar clicks, and never for an edit the mask discarded (a letter, a stray separator). |

`ValidationErrorReason` follows GOV.UK's error taxonomy:

| Reason | Meaning |
|---|---|
| `"missing"` | The visitor emptied the field while no date is committed. An untouched empty field reports nothing, so a form that requires the date checks `value` on submit. Clearing a field that still has a committed value restores that value without a report. |
| `"impossible-date"` | Text was typed but does not name a real calendar day — incomplete, a day that does not exist such as `31.02`, or more groups than a date has. |
| `"not-selectable"` | A real date that `shouldDisableDate` rejects. |

This does **not** make the component an authority on validity. `hasError`
stays visual-only and consumer-controlled, and `shouldDisableDate` remains
the single authority on selectability — a rejection is reported, never
overridden.

### Opt-outs for the built-ins

Every entry defaults to the 0.1.0 behaviour, so no existing caller changes.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `showEcho` | `boolean` | `true` | Render the long-form date under the field. |
| `showWeekdayHeader` | `boolean` | `true` | Render the weekday column headers. The grid keeps its row and cell semantics either way. |
| `showTodayMarker` | `boolean` | `true` | Mark today. Turning it off removes both `data-today` and `aria-current="date"` — never one without the other. |

### Accessibility and labelling

| Prop | Type | Notes |
|---|---|---|
| `aria-label` | `string` | Names the input, the dialog, and leads the calendar trigger's name ("Start date, Open calendar"). |
| `aria-labelledby` | `string` | Forwarded to the input. |
| `id` | `string` | Forwarded to the input, so `<label htmlFor>` names it. |
| `aria-invalid` | `boolean` | Forwarded to the input. |
| `aria-describedby` | `string` | Forwarded to the input, unchanged. |

Prefer `id` with `<label htmlFor>` (or `aria-labelledby`) to wrapping the
picker in a `<label>`: a wrapping label takes its name from all the text
inside it, which includes an in-tree calendar while it is open. The long-form
echo is `aria-hidden` (the trigger's name already says the date in words), so
it no longer leaks into a wrapping label's name.

ARIA the component sets itself: the input has `aria-haspopup="dialog"` and,
while open, `aria-controls`; the trigger (a button) has `aria-haspopup`,
`aria-expanded` and `aria-controls` — `aria-expanded` is not allowed on a
textbox; the dialog is named by `aria-label` when given, otherwise by the
visible month and year; the days grid is `role="grid"` with `aria-selected`
on the selected gridcell and `aria-current="date"` on today; the open month
and year in their views carry `aria-current="true"`. The dialog is
deliberately **non-modal** (no `aria-modal`): the field stays operable while
it is open.

### Keyboard

The field and its calendar behave like a combobox and its popup (D21).

| Where | Key | Action |
|---|---|---|
| Field | ArrowDown | Open the calendar; pressed again, move focus into the open view (days grid, or month/year options). |
| Field | Enter | Commit a typed date and close. In a closed field with nothing typed, Enter is left to the form, so it submits. |
| Field | Tab / Shift+Tab | Close the calendar and move on, as in any form. |
| Days grid | Arrows | Move by day / week, following the layout direction. |
| Days grid | PageUp / PageDown | Previous / next month. Shift: previous / next year. |
| Days grid | Home / End | Start / end of the locale's week. |
| Days grid | Enter / Space | Commit the focused day (a disabled day is ignored). |
| Month / year options | Arrows, Home, End | Move among the options (three columns); one tab stop. |
| Month options | PageUp / PageDown | Previous / next year. |
| Year options | PageUp / PageDown | Twelve years back / forward. |
| Whenever the calendar is open | Escape | Close and return focus to the field. Marked handled (`preventDefault`), so a surrounding `<dialog>` or modal closes the calendar only. |

Focus is never left on `<body>` while the calendar is open. Switching views
from inside it first parks focus on a control that survives the switch;
closing it from the trigger returns focus to the field; a month change that
unmounts the focused day is not treated as leaving, and focus is re-placed on
the new month's day after render. Focus leaving the widget (Tab out of the
calendar, a click elsewhere) commits a typed date, closes the calendar and
fires `onBlur` once. A portaled calendar is left in field order: Shift+Tab
from its first control returns to the field, Tab from its last moves to the
control after the field.

### Touch: `manualEntryOnTouch`

`"second-tap"` (default since 0.5.0) or `"immediate"`.

The field renders `inputMode="none"` until the visitor taps the *text* a second
time while the calendar is open — the one unambiguous signal that they mean to
type rather than pick. `"immediate"` restores the pre-0.5 behaviour, where any
tap on the field raises the keyboard.

Typing is never removed. `inputMode` governs only the *virtual* keyboard, so
hardware keyboards, paste and every a11y affordance are unaffected, and on a
device with a physical keyboard nothing about this is observable at all. That is
why the attribute is not gated behind a pointer check: rendering it
unconditionally is what keeps the server and client markup identical, and the
first tap — the one that must not raise a keyboard — happens before anything
decided after mount could take effect.

How a press is classified: from the `pointerdown` that started it, because
Safari 18.2+ reports a finger's `click` as `pointerType: "mouse"` (WebKit bug
282988). A pen counts as a finger — on tablets a stylus raises an on-screen
keyboard or handwriting panel too.

Two related behaviours are **not** configurable, because both were defects:

- Picking a day returns focus to the input for every activation except a finger
  or a pen. On touch, focusing a text input *is* asking for the keyboard, and
  this path runs on the tap that selected a date. Keyboard and assistive-tech
  activation (`detail === 0`) and a mouse still get focus back, so APG's
  return-focus contract holds for everyone it was written for.
- The popover's above/below side is decided once per open and frozen until
  close. It used to be re-decided on every scroll and resize frame, and an
  on-screen keyboard halves `window.innerHeight`, which collapsed the space
  below the field and flipped the calendar over the top of it mid-interaction.
  Coordinates keep updating, so the popover still tracks the field.

### Popover placement: `portal`

`portal?: boolean | HTMLElement`, default `false` (D17).

- `false`: the popover stays inside the component root, `position: absolute`.
  An `overflow: hidden` ancestor clips it.
- `true`: portal to `document.body` with `position: fixed` coordinates
  measured from the field. An element: portal there instead (a modal host, an
  iframe's body).

A portaled popover follows the field through scrolling, resizing and any
layout change that moves it; keeps to its side of the field, so it never
covers it (when the space between the field and the viewport edge is shorter
than the calendar, its height is capped and it scrolls inside; the cap stops
at 120px, below which the calendar runs past the viewport edge instead of
shrinking further); keeps the field's theme tokens, colour scheme, font and
direction live; and is still part of the widget for outside-press, Escape and
focus handling, including in an iframe's document. Because it is no longer a
DOM descendant of the root, a selector scoped under one of your ancestors
(`.my-form [data-part="day"]`) does not reach it — style it through
`classNames`/`styles` or an unscoped `[data-part]` selector.

Opening from right to left, the popover aligns to the field's right (start)
edge.

### `labels`

`labels?: Partial<Labels>` — the strings `Intl` **cannot** supply. Everything
`Intl` can supply stays derived, which is the whole premise of the package: a
labels map that duplicated month names would rot per locale exactly the way
bundled locale files do. An empty string counts as "not given" for every label
that names a control; for `keyboardHelp` it means "announce nothing".

| Key | Default | Used for |
|---|---|---|
| `keyboardHelp` | "Use the arrow keys to move between days, Page Up and Page Down to change month, and Enter to select." | Announced once, when focus first enters the days grid. **English default — override for non-English UIs.** Marked `lang="en"` while it is the default. |
| `openCalendar` | "Open calendar" | Trigger name while no date is committed. **English default.** |
| `changeDate` | "Change date" | Prefixes the committed date in the trigger name: "Change date, 17 November 2026". **English default.** |
| `closeCalendar` | "Close calendar" | Trigger name while the calendar is open. **English default.** |
| `previousMonth` / `nextMonth` | *derived from `Intl`* | **Override only.** When omitted, the nav buttons are named with the month and year they navigate *to* (e.g. "August 2026"), or with the target year in the months view. |

### Styling — per D3 (option D): self-contained CSS, overridable

| Prop | Type | Notes |
|---|---|---|
| `className` | `string` | Root element. |
| `themeName` | `"default" \| "minimal" \| "soft" \| "high-contrast"` | Stamps `data-rldp-theme` on the root. Unset inherits an ancestor's theme; `"default"` opts out of one. See [`THEMING.md`](THEMING.md). |
| `classNames` | `Partial<Record<Slot, string>>` | Per-slot overrides, one key per part plus a few state keys. The full list is [`ANATOMY.md`](ANATOMY.md). |
| `styles` | `Partial<Record<Slot, CSSProperties>>` | Per-slot inline styles, keyed exactly like `classNames`. |
| `icons` | `Partial<Record<IconName, ReactNode>>` | Substitute the built-in SVGs. A substituted node is rendered as-is. See D4. |

## Named exports

```ts
export { LocaleDatePicker };
export { resolveLocale };    // normalizes a locale tag for Intl
export { todayInTimeZone };  // local-midnight "today" in an IANA zone (D16)
export { ANATOMY };          // the canonical part list (D10)
export type {
  LocaleDatePickerProps, Labels, ThemeName, ValidationErrorReason,
  Slot, PartSlot, Part, IconName,
};
```

`resolveLocale` is exported because the consumer usually needs the same
normalization for their own `Intl` calls, and because the source product already
imports it separately. Keeping it internal would force callers to duplicate it.

---

## Contracts that must not be broken

### Timezone contract

`value` and the argument to `onChange` are **local-midnight `Date` objects**.
Consumers read `getDate()`, `getMonth()`, `getFullYear()` and expect the day the
user clicked.

Never construct values through UTC parsing, never round-trip through
`toISOString()`, and never accept an ISO string as `value` without an explicit
opt-in prop. A picker that silently shifts a date by one day for users west of
UTC is the single most common bug in this category, and it is invisible to
whoever built it if they live in UTC or east of it. Calendar dates are built
with `setFullYear`, so years 0–99 are those years, not 1900–1999.

### Blur ordering

`onBlur` receives the value that was just committed. A parent that validates its
own captured state in the same tick reads the pre-commit closure and flashes a
spurious "required" error. This is why the callback takes an argument at all —
the signature exists because the obvious version was wrong. It fires once,
when focus leaves the widget; moving between the field and its calendar is not
a blur.

### Locale resolution

Some applications use locale codes that are not valid BCP 47 tags. The known
case is Ukrainian written as `ua` (a country code) where `Intl` expects `uk`;
passing `ua` straight through throws a `RangeError` that, in the source product,
crashed hydration of the entire surrounding form.

`resolveLocale` returns the canonical form of the tag (`"en-us"` becomes
`"en-US"`, the deprecated `"iw"` becomes `"he"`), maps known aliases on its
**language subtag** (so `UA`, `ua-UA` and `ua` all resolve; the region is
kept), and falls back to `"en"` on anything `Intl` rejects. **Never pass a caller-supplied locale
string directly into `Intl.DateTimeFormat` without it.**

### Numerals

Every number the widget renders — day numerals, the year pill and list, the
echo, the month title, day names — is in one numbering system: Latin by
default, matching the typed field, or the system a `-u-nu-` extension in
`locale` names. The typed field is always ASCII `dd.MM.yyyy`. See D20.

### Display format

The typed and displayed format is fixed **`dd.MM.yyyy`** for every locale,
with the year padded to four digits. It does not follow `en-US` month-first
ordering or any other locale-derived numeric shape. Consumers that format the
same string for a provider API and for the buyer rely on this; a silent switch
to `MM/dd/yyyy` is data corruption, not a cosmetic change. Changing it is a
major.

### Casing and language

Text `Intl` produces is shown as `Intl` wrote it, except that the echo, the
month pill and the month options capitalise their first letter (CLDR's
titlecase-firstword), using the letter's title-case form with the locale's
rules: Georgian, which has no capitals in running text, is left as written.
The stylesheet never title-cases
`Intl` text; its only `text-transform` upper-cases the weekday column
headers. The echo and the popover carry `lang` set to the language `Intl`
actually formatted in.

### No storage, no network

The component never reads or writes `localStorage` or `sessionStorage`, never
makes network calls, and never phones home. A payment form under GDPR and a
hardened browser (Tor, Firefox ETP Strict) both require this. Adding either
would be a breaking change (see [`RELEASING.md`](RELEASING.md)) — and almost
certainly a reason not to adopt the package on a checkout path.

### SSR

The module imports and renders under Node with no `window` / `document`.
Effects that touch the DOM (outside-click, positioning, portal) only run
client-side when the popover is open. Portaling is a no-op during
`renderToString`.

### Input masking

Typed digits are masked into the display format as the user types, because an
iOS numeric keypad offers no separator keys. Localized digits are normalized
to ASCII before parsing, for **every** numbering system `Intl` knows — the
map is generated from `Intl.NumberFormat` rather than hand-maintained.

- **Typing forward** rolls digits from day to month to year and accepts
  separator keystrokes: `.` `,` `/` `-` and whitespace; the Arabic comma,
  decimal and thousands separators; the ideographic comma and full stop; the
  fullwidth dot, comma, slash and hyphen; and the Cyrillic-layout `ю`/`б`.
  A separator closes the current segment, padding a single-digit day or month
  (`1.` becomes `01.`).
- **An edit inside the text** keeps its separators as fixed boundaries and
  never re-flows digits across them, so one inserted character cannot turn
  into a different date: a group that no longer fits (`115.03.2026`) is left
  on screen as typed and reported, a deleted digit is not re-padded under the
  caret, and deleting a separator inside the date changes nothing.
- **Deleting at the end** is taken as typed, so Backspace backs out of a
  group past its separator (`01.` becomes `01`).
- **More groups than a date has** (`1.2.3.2026`) are kept visible and
  reported, never appended to the year.
- **A year-first paste** (`2026-07-17`, ISO datetimes) is reordered to
  `17.07.2026`.
- **An edit the mask discards entirely** creates no draft, so blur neither
  rewrites the value nor reports an error.
- **IME composition** is shown as-is and masked when it ends; Enter that
  confirms a candidate belongs to the IME.

While the calendar is open, a fully typed date navigates the grid to it live,
and reopening honours an uncommitted typed draft over the committed value. A
new `value` from the parent, `disabled`, or `form.reset()` drops an
uncommitted draft. All of this is load-bearing for mobile and
non-Latin-script users, and easy to lose in a refactor.
