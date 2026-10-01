# Extraction guide

How to port the component out of the source product, and what must survive the
port intact.

## Before you start

The source location is in **`LOCAL-CONTEXT.md`** — gitignored, local to the
operator's machine. If it is not present, ask the operator. Do not guess a path
and do not commit one: this repository is public and the source product
repository is private.

## Ground rules

1. **Port first, improve second.** Two commits minimum: one that moves the code
   with behaviour unchanged, one that changes anything. A combined port-and-
   redesign commit cannot be reviewed, and when something breaks you will not
   know which half did it.
2. **Keep the comments.** The source is unusually densely commented because each
   note records a bug that was actually hit. They are the most valuable thing
   being transferred. Reword for a public audience; do not delete.
3. **Read the parity contract below before writing any code**, not after.

## What to strip

| In source | Becomes |
|---|---|
| Domain-specific prop names for the dates and their bounds | `value`, `minDate`, `maxDate`, `defaultCalendarMonth` |
| The product's locale union type | `string` |
| Product-specific class names and colour tokens | Per D3 |
| Any reference to the product, its domain, or its business rules | Removed entirely |

## What to keep exactly

The exported locale-normalization helper, the masking logic, the `Intl` usage,
the disabled-day predicate contract, the focus handling, and every item below.

---

## Parity contract

**Each line exists because a real bug was found and fixed.** A behaviour that
looks redundant is the one most likely to be load-bearing. If you are convinced
an item is obsolete, write down why and leave it in place — the cost of being
wrong is a regression in someone else's product.

Every line is ticked because every line is now pinned by a test that fails
when the behaviour is removed; [`TESTING.md`](TESTING.md) says where. A line
that loses its test is unticked again until it has one.

### Values and time

- [x] Values are **local-midnight `Date` objects**. No UTC parsing, no
      `toISOString()` round trip anywhere in the commit path.
- [x] A date selected at 23:30 local time is the date the user clicked, not the
      next one.
- [x] Displayed strings and committed values never disagree.

### Locale

- [x] Non-standard locale aliases are normalized before reaching `Intl`. The
      known case is `ua` → `uk`; an unnormalized tag throws a `RangeError` that
      previously crashed hydration of the whole surrounding form.
- [x] Month names, weekday names and the long-form echo come from
      `Intl.DateTimeFormat`, never from a bundled table.
- [x] The first day of the week follows the locale, not a hardcoded Monday or
      Sunday.
- [x] An unknown or malformed locale falls back instead of throwing.

### Interaction

- [x] Clicking a day commits and closes. No confirm button.
- [x] Month and year navigation are two explicit grids, not one long scrolling
      list.
- [x] Typing is possible; digits auto-mask into the display format, because an
      iOS numeric keypad has no separator keys.
- [x] Eastern Arabic-Indic digits are normalized to ASCII before parsing.
- [x] The committed date is echoed under the field in words, so a US/EU
      month-day mix-up is immediately visible.
- [x] `onBlur` receives the **just-committed** value, not captured parent state.
      Validating the closure instead flashes a false "required" error.
- [x] Attempting to open a disabled picker fires `onDisabledOpenAttempt` rather
      than failing silently.

### Constraints

- [x] `shouldDisableDate` remains the single authority on selectable days.
- [x] `minDate` / `maxDate` bound navigation only; they do not override the
      predicate.
- [x] Opening with no value lands on `defaultCalendarMonth`, then today, then
      the first enabled month.

### Accessibility and layout

- [x] `aria-label`, `aria-invalid`, `aria-describedby` pass through to the
      input, with the exact spelling the source's regression tests assert.
- [x] Keyboard navigation works: open, move by day and month, commit, dismiss.
- [x] Focus returns to the input on close.
- [x] RTL locales lay out correctly, including navigation arrow direction.
- [x] Usable down to a 320px viewport.

---

## Known sharp edges

- **The locale crash is not hypothetical.** Passing a raw non-BCP-47 tag into
  `Intl.DateTimeFormat` throws, and in a React island that took down the entire
  form, not just the picker. Normalize before every `Intl` call, including any
  new ones added later.
- **Blur ordering is subtle and will look like a redundant argument** to anyone
  reading `onBlur(current)` fresh. It is not.
- **RTL breaks during restyling, not during porting.** Re-verify it after
  Phase 2, not only after Phase 1.
- **Masking interacts with controlled input.** Moving the cursor or selecting
  text mid-entry is where masked inputs usually fail; cover it in tests. A
  mask that re-flows the whole digit stream on every edit turns one inserted
  character into a different real date — edits inside the text must keep
  their separators as boundaries (fixed in 0.6.0).
- **Focus moving inside the widget is not a blur.** The field and its
  calendar are one widget; committing or validating on the input's own blur
  fired when focus merely moved into the calendar. Act when focus leaves the
  widget (see D21).
- **A portal leaves the ancestor behind.** Direction, font, theme tokens and
  any selector scoped under a consumer ancestor stop reaching a portaled
  popover unless they are carried over explicitly.

## After the port

Run through the parity contract as an actual checklist against the ported
component, ticking each line. Record the result in the Phase 1 commit message.
An unchecked contract is the same as no contract.
