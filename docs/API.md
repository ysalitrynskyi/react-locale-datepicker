# Proposed public API

Derived from the production component, with product-specific naming removed.
Treat this as the target for Phase 1, not as a finished contract — it may change
until the first npm publish, and must not change casually after.

## Component

```tsx
import { LocaleDatePicker } from "react-locale-datepicker";
import "react-locale-datepicker/styles.css"; // depends on D3

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
| `placeholder` | `string` | — | Not derived from the locale: the display format is caller-controlled, so the hint must be too. |
| `direction` | `"ltr" \| "rtl" \| "auto"` | `"auto"` | `"auto"` resolves from the locale. |

### Constraints

| Prop | Type | Notes |
|---|---|---|
| `shouldDisableDate` | `(date: Date) => boolean` | **The single authority on selectability.** `minDate` and `maxDate` limit navigation only. |
| `minDate` | `Date \| null` | Bounds month and year navigation. |
| `maxDate` | `Date \| null` | Bounds month and year navigation. |
| `defaultCalendarMonth` | `Date \| null` | Month shown when opening with no value. Falls back to today, then to the first enabled month. |

Keeping `shouldDisableDate` authoritative rather than deriving it from
`minDate`/`maxDate` is deliberate. Real forms disable scattered sets — weekends,
blackout ranges, a minimum lead time — that a range cannot express.

### State and validation

| Prop | Type | Notes |
|---|---|---|
| `disabled` | `boolean` | |
| `hasError` | `boolean` | Visual only. The component never decides validity. |
| `onBlur` | `(current: Date \| null) => void` | **Receives the just-committed value.** See § Blur ordering. |
| `onDisabledOpenAttempt` | `() => void` | Fires when a user tries to open a disabled picker, so the form can point them at the field they must fill first. |

### Accessibility

| Prop | Type |
|---|---|
| `aria-label` | `string` |
| `aria-invalid` | `boolean` |
| `aria-describedby` | `string` |

### Styling — shape depends on D3

| Prop | Type | Notes |
|---|---|---|
| `className` | `string` | Root element. |
| `classNames` | `Partial<Record<Slot, string>>` | Per-slot overrides: `input`, `popover`, `header`, `grid`, `day`, `daySelected`, `dayDisabled`, `echo`. |
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
iOS numeric keypad offers no separator keys. Eastern Arabic-Indic digits are
normalized to ASCII before parsing. Both behaviours are load-bearing for mobile
and RTL users respectively, and both are easy to lose in a refactor.
