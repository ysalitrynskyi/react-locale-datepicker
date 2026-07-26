# Proposed public API

Derived from the production component, with product-specific naming removed.
Treat this as the target for Phase 1, not as a finished contract — it may change
until the first npm publish, and must not change casually after.

## Component

```tsx
import { LocaleDatePicker } from "react-locale-datepicker";
import "react-locale-datepicker/styles.css"; // optional: omit to go unstyled

<LocaleDatePicker
  value={date}
  onChange={setDate}
  locale="de"
  placeholder="dd.mm.yyyy"
/>;
```

## Props

### Required

| Prop | Type | Notes |
|---|---|---|
| `value` | `Date \| null` | **Local-midnight `Date`.** See § Timezone contract. |
| `onChange` | `(date: Date \| null) => void` | Fires on commit, not on every keystroke. |

### Localization

| Prop | Type | Default | Notes |
|---|---|---|---|
| `locale` | `string` | `"en"` | Any BCP 47 tag `Intl` accepts. Non-standard aliases are normalized — see § Locale resolution. |
| `placeholder` | `string` | — | Not derived from the locale: the display format is fixed (`dd.MM.yyyy`), and the component does not translate hint text, so the caller supplies a hint matching it. A format contract is planned — see `ROADMAP.md`. |
| `direction` | `"ltr" \| "rtl" \| "auto"` | `"auto"` | `"auto"` resolves from the locale. |

### Constraints

| Prop | Type | Notes |
|---|---|---|
| `shouldDisableDate` | `(date: Date) => boolean` | **The single authority on selectability.** `minDate` and `maxDate` limit navigation only. |
| `minDate` | `Date \| null` | Bounds month and year navigation. |
| `maxDate` | `Date \| null` | Bounds month and year navigation. |
| `defaultCalendarMonth` | `Date \| null` | Month shown when opening with no value. Falls back to today, then to the first enabled month. |
| `today` | `Date` | Overrides what counts as "today" (ring, default view, keyboard target, year range). Wins over `timeZone`. For deterministic tests, and for rules not anchored to wall clocks. |
| `timeZone` | `string` | IANA zone "today" is derived in — for availability rules on a fixed business calendar day. `"default"`/`"system"` mean the visitor's zone; invalid names fall back to it. **Never converts the value** — the timezone contract below is untouched. See D16 and the exported `todayInTimeZone`. |

Keeping `shouldDisableDate` authoritative rather than deriving it from
`minDate`/`maxDate` is deliberate. Real forms disable scattered sets — weekends,
blackout ranges, a minimum lead time — that a range cannot express.

### State and validation

| Prop | Type | Notes |
|---|---|---|
| `disabled` | `boolean` | |
| `hasError` | `boolean` | Visual only. The component never decides validity. |

### Opt-outs for the built-ins

Every entry defaults to the 0.1.0 behaviour, so no existing caller changes.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `showEcho` | `boolean` | `true` | Render the long-form date under the field. |
| `showWeekdayHeader` | `boolean` | `true` | Render the weekday column headers. The grid keeps its row and cell semantics either way. |
| `showTodayMarker` | `boolean` | `true` | Mark today. Turning it off removes both `data-today` and `aria-current="date"` — never one without the other. |
| `onBlur` | `(current: Date \| null) => void` | **Receives the just-committed value.** See § Blur ordering. |
| `onDisabledOpenAttempt` | `() => void` | Fires when a user tries to open a disabled picker, so the form can point them at the field they must fill first. |
| `onValidationError` | `(reason: ValidationErrorReason) => void` | Reports why a **typed** entry did not commit. The component classifies and reports; the consumer renders. Never fires for calendar clicks. |

`ValidationErrorReason` follows GOV.UK's error taxonomy:

| Reason | Meaning |
|---|---|
| `"missing"` | The field was left empty. |
| `"impossible-date"` | Text was typed but does not name a real calendar day — incomplete, or a day that does not exist such as `31.02`. |
| `"not-selectable"` | A real date that `shouldDisableDate` rejects. |

This does **not** make the component an authority on validity. `hasError`
stays visual-only and consumer-controlled, and `shouldDisableDate` remains
the single authority on selectability — a rejection is reported, never
overridden.

### Accessibility

| Prop | Type |
|---|---|
| `aria-label` | `string` |
| `aria-invalid` | `boolean` |
| `aria-describedby` | `string` |

#### `labels`

`labels?: Partial<Labels>` — the strings `Intl` **cannot** supply. Everything
`Intl` can supply stays derived, which is the whole premise of the package: a
labels map that duplicated month names would rot per locale exactly the way
bundled locale files do. Duet needed roughly thirteen strings per locale;
this is four.

| Key | Default | Used for |
|---|---|---|
| `keyboardHelp` | "Use the arrow keys to move between days, Page Up and Page Down to change month, and Enter to select." | Announced once, when focus first enters the days grid. |
| `openCalendar` | "Open calendar" | Trigger name while no date is committed. |
| `changeDate` | "Change date" | Prefixes the committed date in the trigger name: "Change date, 17 November 2026". |
| `closeCalendar` | "Close calendar" | Trigger name while the calendar is open. |
| `previousMonth` / `nextMonth` | *derived* | **Override only.** By default the nav buttons are named with the month and year they navigate to, from `Intl` — better than a static string. Set these only for fixed wording. |

### Styling — per D3 (option D): self-contained CSS, overridable

| Prop | Type | Notes |
|---|---|---|
| `className` | `string` | Root element. |
| `themeName` | `"default" \| "minimal" \| "soft" \| "high-contrast"` | Stamps `data-rldp-theme` on the root. Unset inherits an ancestor's theme; `"default"` opts out of one. See [`THEMING.md`](THEMING.md). |
| `classNames` | `Partial<Record<Slot, string>>` | Per-slot overrides, one key per part plus a few state keys. The full list is [`ANATOMY.md`](ANATOMY.md); the 0.1.0 keys are unchanged. |
| `styles` | `Partial<Record<Slot, CSSProperties>>` | Per-slot inline styles, keyed exactly like `classNames`. |
| `icons` | `Partial<Record<IconName, ReactNode>>` | Substitute the built-in SVGs. See D4. |

## Named exports

```ts
export { LocaleDatePicker };
export { resolveLocale };          // normalizes a locale tag for Intl
export type { LocaleDatePickerProps, Slot, IconName };
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
whoever built it if they live in UTC or east of it.

### Blur ordering

`onBlur` receives the value that was just committed. A parent that validates its
own captured state in the same tick reads the pre-commit closure and flashes a
spurious "required" error. This is why the callback takes an argument at all —
the signature exists because the obvious version was wrong.

### Locale resolution

Some applications use locale codes that are not valid BCP 47 tags. The known
case is Ukrainian written as `ua` (a country code) where `Intl` expects `uk`;
passing `ua` straight through throws a `RangeError` that, in the source product,
crashed hydration of the entire surrounding form.

`resolveLocale` maps known aliases and falls back safely on anything `Intl`
rejects. **Never pass a caller-supplied locale string directly into
`Intl.DateTimeFormat` without it.**

### Input masking

Typed digits are masked into the display format as the user types, because an
iOS numeric keypad offers no separator keys. Localized digits are normalized
to ASCII before parsing, for **every** numbering system `Intl` knows — the
map is generated from `Intl.NumberFormat` rather than hand-maintained, so
Devanagari, Bengali, Myanmar, Thai and the rest work alongside the two
Arabic-Indic ranges. Separator keystrokes are accepted, not stripped: `.`
`,` `/` `-` and the Arabic and ideographic commas close the current segment,
padding a single-digit day or month (`1.` becomes `01.`). While the calendar
is open, a fully typed date navigates the grid to it live, and reopening the
calendar honours an uncommitted typed draft over the stale committed value.
All of these are load-bearing for mobile and non-Latin-script users, and all
are easy to lose in a refactor.
