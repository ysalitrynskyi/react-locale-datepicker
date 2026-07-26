# Testing requirements

**There is no test suite to inherit.** The cross-browser matrix that validated
the original component was run ad-hoc during its development and was never
committed. Assume zero coverage on day one, and budget Phase 3 accordingly — it
is the largest single cost in this project.

## Stack

Recommended, adjust with reason:

- **Vitest** + **@testing-library/react** for unit and interaction tests.
- **Playwright** for the cross-browser and locale matrix.
- Run both in CI on every push.

## Coverage that must exist before any publish

### Date arithmetic and values

- [ ] A selected day commits as **local midnight**.
- [ ] No value shifts by a day. Run the suite under at least three timezones —
      `UTC`, one negative offset (`America/Los_Angeles`), one positive
      (`Asia/Tokyo`) — via the `TZ` environment variable.
- [ ] Month boundaries: 28, 29, 30 and 31-day months.
- [ ] A leap-year 29 February selection.
- [ ] Year boundary navigation in both directions.

### Locale

- [ ] Month and weekday names come from `Intl` for: one Latin locale (`de`), one
      Cyrillic (`uk`), one CJK (`ja`), one RTL (`ar`).
- [ ] Locale aliasing: `ua` resolves to `uk` and **does not throw**. This is a
      regression test for a crash that took down an entire form.
- [ ] An unknown locale (`zz-ZZ`) falls back without throwing.
- [ ] The first day of the week follows the locale — verify a locale that starts
      on Sunday and one that starts on Monday.
- [ ] The long-form echo renders in the active locale.

### Input and masking

- [ ] Typed digits mask into the display format.
- [ ] Eastern Arabic-Indic digits normalize to ASCII and parse.
- [ ] Partial or malformed input does not commit a wrong date.
- [ ] Cursor position and mid-string editing behave — the classic masked-input
      failure.
- [ ] Paste is handled.

### Interaction

- [ ] One tap on a day commits and closes.
- [ ] `shouldDisableDate` blocks selection, by click and by keyboard.
- [ ] `minDate` / `maxDate` bound navigation but do not override the predicate.
- [ ] Opening with no value lands on `defaultCalendarMonth`, then today, then
      the first enabled month.
- [ ] `onBlur` receives the just-committed value — assert the argument, not
      parent state. Regression test for the false "required" error.
- [ ] `onDisabledOpenAttempt` fires when a disabled picker is tapped.

### Accessibility

- [ ] `aria-label`, `aria-invalid`, `aria-describedby` reach the input with the
      exact expected spelling.
- [ ] Full keyboard path: open, navigate, commit, dismiss.
- [ ] Focus returns to the input on close.
- [ ] Automated axe pass on the open popover.

### Layout

- [ ] RTL renders correctly, including navigation arrow direction.
- [ ] 320px viewport is usable.
- [ ] The popover flips above the field and shifts horizontally so the
      viewport never clips it. (Escaping `overflow: hidden` ancestors needs
      the portal/top-layer work scheduled in `ROADMAP.md` and is a documented
      limitation until then.)

## Browser matrix

Chromium, Firefox and WebKit, at 320px, 768px and 1280px. The original was
validated across this matrix; a published package should hold the same bar.

## CI

- Unit and interaction tests on every push and pull request.
- The Playwright matrix at least on pull requests to the default branch.
- **A red suite blocks a release.** No exceptions — the credibility of a
  component extracted "from production" rests entirely on it being tested.

## A note on what these tests are for

Most of them are not checking that the component works. They are checking that
the specific bugs listed in `EXTRACTION.md` § Parity contract stay fixed. Write
each one so the failure message names the bug it guards, and a future maintainer
will know why they must not delete it.
