# Bug hunt ledger

Identity: BUGHUNT-react-locale-datepicker-2026-09-30

Hunt status: complete

Findings only. No fixes in this file's commits.

## Areas

- [x] **src/date-locale-helpers** — reviewed 2026-09-30. `src/LocaleDatePicker.tsx` from `isCoarsePointer` through `usableDate` (lines 336-781). Tests read with that code: `tests/resolveLocale.test.ts`, `tests/digits.test.tsx`, `tests/masking.test.tsx`, `tests/timezone-today.test.tsx`, `tests/ukrainian-input.test.tsx`, `tests/historical-dates.test.tsx`, `tests/locale.test.tsx`, `tests/values-timezone.test.tsx`, `tests/invalid-date.test.tsx`. Pointer, activation, and icon helpers in that span: no bug found. `todayInTimeZone` (including `Asia/Kathmandu`, `Europe/Kiev` / `Europe/Kyiv`, `UTC`) and `firstDayOfWeek` (`en-US` Sunday, `de-DE` Monday, `ar` Saturday, `7 % 7 === 0`) matched Intl on this machine.
- [x] **src/picker-open-commit** — reviewed 2026-09-30. `LocaleDatePicker` state, open/close, portal, positioning, `commit` / `commitTyped`, blur, and the input handlers (`src/LocaleDatePicker.tsx` from the component signature through `commitTyped`, plus the field JSX). Not the day/month/year grid model. Seven bugs: BH-014 through BH-020. The disabled-trigger miss is already BH-010. Pen-as-touch focus is already BH-009. Portaled `dir` is already BH-013.
- [x] **src/picker-calendar-grids** — reviewed 2026-09-30. Days, months, and years grids, keyboard map, roving tabindex, weekday headers, accessible names, min/max clamps in `src/LocaleDatePicker.tsx`. Two bugs: BH-012 (chevron month change leaves keyboard on the previous date), BH-013 (portaled grid stays LTR while arrow keys follow the field's `dir`).
- [x] **src/styles** — reviewed 2026-09-30. `src/styles.css` against the classes and data attributes the component sets. Three bugs: BH-021 (portaled popover misses the border-box reset and overflows 320px), BH-022 (selected-day focus ring matches the fill in minimal and high-contrast), BH-023 (named themes bypass the `light-dark()` fallback).
- [x] **src/public-exports** — reviewed 2026-09-30. `src/index.ts` against `docs/API.md` and the exported types on `LocaleDatePickerProps`. Named value and type exports that the API names (`LocaleDatePicker`, `resolveLocale`, `todayInTimeZone`, `LocaleDatePickerProps`, `Slot`, `IconName`, and the other types `index.ts` re-exports) are present. Two prop-table mismatches: BH-007, BH-008.
- [x] **tests/commit-and-contract** — reviewed 2026-09-30. `tests/interaction.test.tsx`, `tests/typed-sync.test.tsx`, `tests/validation-error.test.tsx`, `tests/opt-outs.test.tsx`, `tests/consumer-contract.test.tsx`, `tests/ssr-contract.test.tsx`, `tests/helpers.tsx`. Three tests stay green when the behaviour they name is removed: BH-024, BH-025, BH-026. `tests/helpers.tsx` date builders use local getters. The UTC greenwash test in `tests/consumer-contract.test.tsx` is a no-op by its own comment; CI still runs `TZ=America/Los_Angeles`, `Asia/Tokyo`, and `Asia/Kathmandu`, so that one was not filed.
- [x] **tests/a11y-and-presentation** — reviewed 2026-09-30. The listed a11y, announcement, keyboard, grid, touch, anatomy, styles-map, and theme tests. Eight tests stay green when the behaviour they name is removed: BH-027 through BH-034.
- [x] **e2e/playwright** — reviewed 2026-09-30. `e2e/matrix.spec.ts`, `e2e/themes.spec.ts`, `e2e/harness/`, `e2e/color.ts`. One test that stays green when the clip it claims to prove is gone: BH-011.
- [x] **docs/contracts** — reviewed 2026-09-30. `docs/API.md`, `docs/EXTRACTION.md`, and `docs/PLAN.md` against the implementation. The `direction` prop contradiction is BH-007. Two further drifts: BH-009 (pen focus), BH-010 (disabled trigger).

## Bugs

### BH-001

- **File:** `src/LocaleDatePicker.tsx:405` (alias table) and `src/LocaleDatePicker.tsx:413` (candidate selection)
- **What is wrong:** `LOCALE_ALIASES` maps only the exact string `"ua"`. `"UA"`, `"Ua"`, `"uA"`, and `"ua-UA"` are not aliases. On this Node (v20.12.2) `Intl.DateTimeFormat` does not throw for those tags, so `resolveLocale` returns them unchanged. Formatting with the returned tag does not produce Ukrainian: `resolvedOptions().locale` is the host default (`en-CA` here) and `month: "long"` for 12 August 2026 is `"August"`, not `"серпень"`. `resolveLocale("ua")` correctly returns `"uk"` and formats as `"серпень"`. `resolveLocale("uk-UA")` is fine.
- **Why it matters:** The parity contract exists because a raw `ua` tag either threw and took down the surrounding form, or resolved differently on the server and in the browser. The usual spelling of that same country code is uppercase `"UA"`, and `"ua-UA"` is the same tag with a region. Both skip the alias, do not hit the `"en"` fallback (nothing throws), and silently format in the implementation's default language. Weekday names, the long-form echo, and the month grid follow that wrong locale. `tests/resolveLocale.test.ts` only asserts the lowercase tag.
- **How to reproduce:**
  1. `resolveLocale("UA")` returns `"UA"`, not `"uk"`. Same for `"ua-UA"`.
  2. `new Intl.DateTimeFormat(resolveLocale("UA"), { month: "long", calendar: "gregory" }).format(new Date(2026, 7, 12))` is `"August"`.
  3. Render `<LocaleDatePicker locale="UA" value={new Date(2026, 7, 12)} onChange={() => {}} />`. The echo and, once opened, the month title are English. `locale="ua"` shows Ukrainian.

### BH-002

- **File:** `src/LocaleDatePicker.tsx:703` (`SEPARATOR_CHAR`)
- **What is wrong:** The separator allowlist is `. , / -`, Arabic comma `،` (U+060C), ideographic comma `、` (U+3001), whitespace, and Cyrillic `ю`/`б`. It does not include the decimal/period keys that other layouts actually emit. Those characters are dropped, so single-digit day and month digits run together. Confirmed by executing the same `maskTyped` rules:
  - `1٫8٫2026` and `١٫٨٫٢٠٢٦` (Arabic decimal separator U+066B) become `18.20.26`, not `01.08.2026`.
  - `1٬8٬2026` and `١٬٨٬٢٠٢٦` (Arabic thousands separator U+066C) become `18.20.26`.
  - `1。8。2026` (ideographic full stop U+3002) becomes `18.20.26`.
  - `１．８．２０２６` and `１，８，２０２６` (fullwidth full stop U+FF0E / fullwidth comma U+FF0C, digits in the `fullwide` numbering system the digit map does accept) become `18.20.26`.
  - Two-digit groups still survive when the separators are merely dropped (`١٥٫٠٨٫٢٠٢٦` becomes `15.08.2026`), which is why `tests/digits.test.tsx` stays green.
- **Why it matters:** This is the same failure as the Cyrillic `ю`/`б` bug the allowlist was extended for: the key a typist uses as "next segment" is eaten, and the field shows a different grouping (`18.20.26`) as if it had been typed. `parseTyped` then returns null (the year is no longer four digits), so blur reports `impossible-date` and reverts. A single-digit day or month cannot be entered with that key. Arabic comma is on the list; the Arabic decimal separator, which is the decimal key in Arabic locales, is not. Fullwidth digits are normalized, then fullwidth punctuation undoes the padding.
- **How to reproduce:** Focus the input and paste `١٫٨٫٢٠٢٦` or `１．８．２０２６`. The value becomes `18.20.26`. Expected: `01.08.2026`, matching `1.8.2026` / `1,8,2026` / `1ю8ю2026`.

### BH-003

- **File:** `src/LocaleDatePicker.tsx:721` (segment fill) and `src/LocaleDatePicker.tsx:729` (separator branch)
- **What is wrong:** A third separator is ignored once the year segment is open, and the digits of a further group are appended to the year. `1.2.3.2026` masks to `01.02.3202` (the stray `3` becomes the first year digit and the final `6` is dropped because the year stops at four digits). `parseTyped` accepts `01.02.3202` as 1 February 3202. `commitTyped` (`src/LocaleDatePicker.tsx:1283`) commits that date. `minDate` / `maxDate` do not block typed commits.
- **Why it matters:** The mask manufactures a real calendar day the user did not type, and blur commits it. The comments on this function treat a silently different date as the failure that must not happen. Nothing in `tests/masking.test.tsx` pastes a four-group string. The Feb 31 test would also stay green for a rolled date: it only asserts that no call is the impossible pair month-index 1 and day 31, and then checks the input text.
- **How to reproduce:**
  1. Render an empty picker.
  2. Paste or change the input to `1.2.3.2026`.
  3. Observed value: `01.02.3202`.
  4. Blur or press Enter.
  5. `onChange` receives a local-midnight Date whose year is 3202, month February, day 1. Expected: do not commit; keep the draft invalid or preserve the typed groups.

### BH-004

- **File:** `src/LocaleDatePicker.tsx:601` (`formatDisplay`)
- **What is wrong:** The day and month are padded to two digits. The year is `date.getFullYear()` with no padding. The documented display format is `dd.MM.yyyy`. Years 100 through 999 therefore render with fewer than four year digits (`new Date(999, 0, 1)` shows `01.01.999`). `parseTyped` requires `\d{4}`, so the string on screen does not parse. Typing the padded form `01.01.0999` does parse (year 999, which is outside the `Date` 0-99 pitfall), `commitTyped` stores it, then `formatDisplay` writes `01.01.999` back. The next edit of that string cannot commit until the user happens to produce eight digits, which changes the year (appending `0` to `01.01.999` masks to `01.01.9990`).
- **Why it matters:** Displayed text and the committed value stop round-tripping, which breaks the fixed `dd.MM.yyyy` contract. The default year grid starts at today minus 120 years, so a stock birth-date range never shows this. `minDate` / `value` are not floored: `new Date(999, 0, 1)` is a normal local Date and `yearsRange` will list 999 when `minDate` is that year or earlier. `tests/historical-dates.test.tsx` only covers 1900 upward.
- **How to reproduce:**
  1. `formatDisplay(new Date(999, 0, 1))` is `01.01.999`, not `01.01.0999`.
  2. Render with `value={new Date(999, 0, 1)}`. The input shows `01.01.999`.
  3. Change the input to `01.01.0999` and blur. `onChange` fires for year 999, then the input snaps back to `01.01.999`.
  4. Blur again without adding a fourth year digit. `parseTyped("01.01.999")` is null, so the edit is `impossible-date` and the three-digit string remains.

### BH-005

- **File:** `src/LocaleDatePicker.tsx:758` (`parseTyped`)
- **What is wrong:** The rollover check constructs `new Date(year, month - 1, day)`. For year arguments 0 through 99, ECMAScript maps that to 1900-1999. The following `getFullYear() !== year` check then fails, so the function returns null instead of a date in that year. `01.01.0099` masks unchanged and parses as null. `new Date(99, 0, 1).getFullYear()` is 1999. A real year-99 date built with `setFullYear(99)` displays as `01.01.99` (see BH-004) and also does not parse.
- **Why it matters:** The null result is reported to the consumer as `impossible-date`, the same signal as 31 February. 1 January 0099 is a real proleptic Gregorian day. Years 100 and above are not affected by this mapping (`01.01.0100` parses as year 100). Combined with BH-004, every year below 1000 either will not parse or will not display in the form that parses.
- **How to reproduce:** Mask `01.01.0099` (it stays `01.01.0099`). `parseTyped` returns null. In the picker, blur that text: `onValidationError("impossible-date")`, no `onChange`. Contrast `01.01.0100`, which commits year 100, and `29.02.1900`, which correctly returns null.

### BH-006

- **File:** `src/LocaleDatePicker.tsx:780` (`usableDate`)
- **What is wrong:** A value is accepted only when `d instanceof Date`. A Date created with another realm's constructor (an iframe's `contentWindow.Date`, or `vm.runInNewContext("Date")`) has `Object.prototype.toString` `[object Date]` and a finite `getTime()`, but `instanceof Date` is false. `usableDate` returns null. The same file already refuses `instanceof HTMLElement` for portal targets for this reason (`src/LocaleDatePicker.tsx:916`).
- **Why it matters:** `value`, `minDate`, `maxDate`, `defaultCalendarMonth`, and `today` all go through `usableDate`. A cross-realm value is treated as empty (blank input, no echo). A cross-realm `minDate` / `maxDate` is treated as no bound. `tests/invalid-date.test.tsx` only passes `new Date("nope")` from the test realm, so it stays green.
- **How to reproduce:**
  1. `const ForeignDate = vm.runInNewContext("Date"); const d = new ForeignDate(2026, 5, 15);`
  2. `d instanceof Date` is false. `d.getFullYear()` is 2026 and `Number.isNaN(d.getTime())` is false.
  3. Pass `d` as `value`. The input renders empty, same as `value={null}`. Expected: show `15.06.2026`.

### BH-007

- **File:** `docs/API.md:36` (props table) and `src/LocaleDatePicker.tsx:173` (`LocaleDatePickerProps`)
- **What is wrong:** The props table documents `direction?: "ltr" | "rtl" | "auto"` with default `"auto"` ("resolves from the locale"). `LocaleDatePickerProps` has no `direction` field. Nothing in the component sets `dir` from `locale`. RTL is only `closest("[dir]")` inside `isRTL` (`src/LocaleDatePicker.tsx:1372`) and a `[dir="rtl"]` stylesheet rule. README calls `docs/API.md` the full contract. `docs/ROADMAP.md` still lists this prop as unshipped RTL work, so the table is ahead of the code.
- **Why it matters:** A consumer who follows the props table fails excess-property checking. Omitting the prop also does not do what the default claims: `locale="ar"` or `locale="he"` does not switch direction. Chevron flipping and grid arrow direction follow an ancestor `dir`, not the locale.
- **How to reproduce:**
  1. `import { LocaleDatePicker } from "react-locale-datepicker"`.
  2. Render `<LocaleDatePicker value={null} onChange={() => {}} placeholder="dd.mm.yyyy" direction="rtl" />`.
  3. `tsc` reports that `direction` does not exist on `LocaleDatePickerProps`.
  4. Drop the prop and render `locale="ar"` inside a tree with no `dir`. The popover stays LTR.

### BH-008

- **File:** `docs/API.md:28` (Required table) and `src/LocaleDatePicker.tsx:190` (`placeholder`)
- **What is wrong:** The Required table lists only `value` and `onChange`. `placeholder` sits in the Localization table with no default. The type is `placeholder: string` (required). There is no default in the destructure (`src/LocaleDatePicker.tsx:788`).
- **Why it matters:** A consumer who supplies the two documented required props does not type-check. The input renders `placeholder={placeholder}` with nothing to fall back on, so the omission is not optional at the type boundary even though the contract table says it is.
- **How to reproduce:**
  1. Render `<LocaleDatePicker value={null} onChange={() => {}} />` with no `placeholder`.
  2. `tsc` errors: property `placeholder` is missing on `LocaleDatePickerProps`.
  3. The same element with `placeholder=""` type-checks. The API Required table does not say that.

### BH-009

- **File:** `docs/API.md:116` and `src/LocaleDatePicker.tsx:374` (`activationOf`), `src/LocaleDatePicker.tsx:1268` (`commit`)
- **What is wrong:** The contract says picking a day returns focus to the input for every activation except a finger, and that a mouse or pen still gets focus back. `activationOf` returns `"touch"` when `pointerType === "pen"`. `commit` calls `close(by !== "touch")`, so a pen click closes without focusing the input. A Chromium pen click is a `PointerEvent` with `pointerType: "pen"` and `detail: 1`, so it does not take the `detail === 0` keyboard path either.
- **Why it matters:** A stylus user who picks a date is dropped off the field when the day button unmounts. The doc says the return-focus contract still holds for pen, because a pen does not raise the on-screen keyboard. The next tab stop is no longer the date field.
- **How to reproduce:**
  1. Open the calendar and leave the input focused.
  2. Activate a day with a pen click (`pointerType: "pen"`, `detail: 1`).
  3. The dialog closes and `onChange` fires.
  4. `document.activeElement` is not the input. A mouse click on the same day focuses the input.

### BH-010

- **File:** `docs/API.md:70`, `docs/EXTRACTION.md:78`, and `src/LocaleDatePicker.tsx:2030` (trigger)
- **What is wrong:** Both docs say that trying to open a disabled picker fires `onDisabledOpenAttempt` instead of failing silently. The calendar trigger is `<button disabled>` and its only opener is `onMouseDown` → `openPopup`. In Chromium, a click on that button (the padding or the icon SVG) does not dispatch `mousedown` to the button or to ancestors. `pointerdown` does fire; `mousedown` does not, so React never runs `onMouseDown`. The read-only input still fires the callback, because that path is `onClick` on an input that is `readOnly`, not a disabled button.
- **Why it matters:** The control named "Open calendar" is the open affordance. A click on it while the picker is disabled does not notify the form, so the form cannot point the user at the field they must fill first. The attempt fails silently, which is the case the callback exists to prevent. `tests/interaction.test.tsx` and `e2e/matrix.spec.ts` only click the text field, so they stay green.
- **How to reproduce:**
  1. Render `<LocaleDatePicker disabled value={null} onChange={() => {}} placeholder="dd.mm.yyyy" onDisabledOpenAttempt={fn} />`.
  2. In Chromium, click the calendar icon, not the text field.
  3. `fn` is not called, and the dialog does not open.
  4. Click the text field. `fn` is called once.

### BH-011

- **File:** `e2e/matrix.spec.ts:175` (assertion at line 186)
- **What is wrong:** `clipped` is `visibleHeight < dialogHeight - 1`, and `visibleHeight` is only the overlap of the dialog and card `getBoundingClientRect()` boxes. That overlap is layout, not paint. `getBoundingClientRect` ignores `overflow: hidden`, so the flag stays true whenever the absolute calendar is taller than the 72px card (`e2e/harness/main.tsx:126`) and hangs out of it.
- **Why it matters:** The test name and the assertion message say an in-tree popover is clipped, and that a failure would mean the portal prop is unnecessary. Removing `overflow: hidden`, or switching the popover to `position: fixed` while leaving it in the card, still leaves `insideCard` true, `data-portaled` unset, and `clipped` true. The days can be fully painted and the test stays green. Nothing in this test hit-tests a day or checks that a day is outside the clip. The portal test below does hit-test a day; this one does not.
- **How to reproduce:**
  1. In `e2e/harness/main.tsx`, change the overflow card from `overflow: "hidden"` to `overflow: "visible"`.
  2. Run the test "in-tree popover is clipped by an overflow:hidden ancestor" on a `1280` project.
  3. The calendar paints in full below the card.
  4. `clipped` is still true, because the dialog border box still extends past the card border box, and the test passes.

### BH-012

- **File:** `src/LocaleDatePicker.tsx:1411` (`onGridKeyDown` uses `focusDay`) and `src/LocaleDatePicker.tsx:1783` (cell `key={i}`)
- **What is wrong:** If a day button is focused and the visible month changes without unmounting the days grid (next/previous chevron), React reuses that button for a different date. Arrow keys and Enter still use the previous `focusDay`, so the grid jumps back to the old month or commits the old day. Chevron handlers (`shiftMonth`, line 1366) change `viewMonth` and do not update `focusDay`. Cells are keyed by week and column index, so the same DOM button stays focused and its `onFocus` does not run again. The popover `mousedown` handler calls `preventDefault` (line 1620), which keeps focus on that button while the chevron click is handled.
- **Why it matters:** The date announced and shown under the focus ring is not the date Enter commits, and the next arrow key leaves the month the user just opened. A keyboard user who moves to a day and then changes month with the chevron (or a pointer user who tabbed into the grid) gets a different day than the one they confirm.
- **How to reproduce:**
  1. Open the picker on 15 July 2026 with locale `en-US` (Sunday week start). 15 July is week index 2, column 3.
  2. Focus the field and press ArrowDown twice so the 15 July button is focused.
  3. Click the next-month chevron. `mousedown` preventDefault leaves focus on that button. August 2026 reuses week 2 column 3 for 12 August (`data-day` changes from `2026-6-15` to `2026-7-12`). `focusDay` is still 15 July.
  4. Press ArrowRight. The handler adds one day to 15 July, the grid jumps back to July, and focus lands on 16 July.
  5. Repeat steps 2–3 and press Enter. The committed date is 15 July 2026, not 12 August.

### BH-013

- **File:** `src/LocaleDatePicker.tsx:1372` (`isRTL`) and `src/LocaleDatePicker.tsx:1894` (portal)
- **What is wrong:** With `portal` and `dir="rtl"` on an ancestor of the field (not of the portal target), ArrowLeft and ArrowRight follow RTL, but the portaled day grid does not. ArrowRight moves to the previous day while the week still runs left to right. `isRTL` reads `rootRef.closest("[dir]")` on the field. `portal={true}` renders the dialog on `document.body` and never copies `dir`. Theme sync copies only `--rldp*` and `color-scheme`. Weekday columns are a CSS grid (`grid-template-columns: repeat(7, ...)`), so they reverse only with inherited `direction: rtl`. The chevron rule is `:where([dir="rtl"]) :where(.rldp-nav-icon)`. In-tree, the dialog is inside that ancestor and ArrowRight correctly lands on the previous day. Portaled, the dialog is not under `[dir="rtl"]` and the same key still lands on the previous day. If `dir="rtl"` is on `<html>` itself, the portal stays inside it and this does not happen.
- **Why it matters:** A portaled picker inside an RTL card or modal moves the keyboard cursor against the visual order. The parity contract requires RTL layout, including arrow direction, to match. The missing `direction` prop (BH-007) means an ancestor `dir` is the only way to request RTL, and portaling drops it.
- **How to reproduce:**
  1. Wrap the picker in `<div dir="rtl">` and set `portal`. Leave `<html>` as LTR.
  2. Open 15 July 2026 and press ArrowDown twice so 15 July is focused.
  3. Press ArrowRight.
  4. Focus moves to 14 July. The dialog is not under `[dir="rtl"]`, so columns stay left to right. ArrowRight should move to 16 July.
  5. Repeat with `portal` unset: ArrowRight moves to 14 July, which matches the reversed columns.

### BH-014

- **File:** `src/LocaleDatePicker.tsx:1979` (second-tap `blur`/`focus`) and `src/LocaleDatePicker.tsx:2021` (input `onBlur`)
- **What is wrong:** The second tap raises the on-screen keyboard by blurring the input and focusing it again inside the click. That blur is not marked as internal. React runs the input `onBlur`, which always calls `commitTyped()` and then the parent `onBlur`. A partial draft is reported as `impossible-date` and wiped (`setDraft(null)`). A finished draft is committed via `onChange` before the visitor has typed anything else. With no draft, the parent `onBlur` still runs with the current value. Focus is back on the input when the handler returns, so the visitor never left the field.
- **Why it matters:** `onBlur` is the signal parents use to validate. The parity note exists because validating at the wrong moment flashes a false "required" error. This fires that callback on the tap whose only job is to allow typing. An empty required field errors at the moment of the second tap. A hardware keyboard can already have put a partial draft in the field (`inputMode="none"` does not block it); the second tap then deletes it. `tests/touch-keyboard.test.tsx` only asserts `inputmode` and `activeElement` after the second click.
- **How to reproduce:**
  1. Render an empty picker with the default `manualEntryOnTouch` (`"second-tap"`) and a coarse pointer (or a click whose `pointerType` is `"touch"` or absent).
  2. Focus the input, click it so the calendar opens, and type `1`. The input shows `1`.
  3. Click the input again.
  4. `inputmode` becomes `numeric` and focus stays on the input. `onBlur` has been called once, `onValidationError("impossible-date")` has fired, and the input is empty. `onChange` has not fired.
  5. Repeat with no draft. `onBlur` still fires with the current value (`null` when the field is empty).

### BH-015

- **File:** `src/LocaleDatePicker.tsx:2011` (input ArrowDown), `src/LocaleDatePicker.tsx:1384` (`focusGridDay` focuses the day), and `src/LocaleDatePicker.tsx:2021` (input `onBlur`)
- **What is wrong:** The second ArrowDown is documented as moving the keyboard into the grid. `focusGridDay` calls `btn.focus()` synchronously, which blurs the input. `onBlur` runs `commitTyped()` and the parent `onBlur` with no check that focus moved into this picker's own dialog. A partial draft is `impossible-date` and the text reverts. A complete draft is committed while the calendar stays open. An empty field still notifies the parent. The popover's `onMouseDown` calls `preventDefault` specifically so a pointer press inside the dialog does not do this (`src/LocaleDatePicker.tsx:1617`). There is no equivalent for a focus move whose `relatedTarget` is inside the dialog.
- **Why it matters:** Entering the grid is not leaving the field. The false "required" flash the mousedown guard was added to prevent happens on the keyboard path that is supposed to enter the grid. The typed digits disappear before the visitor picks a day. `tests/keyboard-map.test.tsx` presses that ArrowDown and does not spy on `onBlur`. `tests/validation-error.test.tsx` expects Tab to validate, which is a different gesture; it never ArrowDowns with a draft.
- **How to reproduce:**
  1. Render `value={new Date(2026, 7, 10)}` so the field shows `10.08.2026`.
  2. Focus the input, press ArrowDown once (calendar opens, focus stays in the input), type `1`.
  3. Press ArrowDown again.
  4. Focus is on the roving day button. `onValidationError("impossible-date")` fires, `onBlur` fires, and the input snaps back to `10.08.2026`. The dialog stays open.

### BH-016

- **File:** `src/LocaleDatePicker.tsx:1246` (`commit` click guard)
- **What is wrong:** After every commit, a capture-phase `click` listener is added to `document` for 350ms. The listener calls `preventDefault` and `stopPropagation` on every click, not only a second click inside the rectangle the popup just left. The timeout is not stored and is not cleared on unmount, so the guard keeps swallowing clicks after the picker is gone. Stacked commits stack listeners.
- **Why it matters:** The comment describes an accidental double-click landing on whatever sits under the closed popup. The implementation cancels the next click anywhere on the page: the trigger (so the calendar cannot be reopened immediately), Submit, or the next field. A checkout that navigates or unmounts on `onChange` still eats the next click for 350ms. `tests/setup.ts` replaces `document.addEventListener` and drops every `click` listener registered with capture `true`, so the suite cannot fail on this. Confirmed without that patch: after a day click, a following click on another button does not reach the button.
- **How to reproduce:**
  1. Open the picker and click a day. `onChange` fires and the dialog closes.
  2. Within 350ms, click a button elsewhere on the page (Submit, or the calendar trigger).
  3. That click does not activate. After 350ms it does.
  4. Unmount the picker in the `onChange` of step 1 and click again within 350ms. The click is still swallowed.

### BH-017

- **File:** `src/LocaleDatePicker.tsx:375` (`activationOf`) — call sites `src/LocaleDatePicker.tsx:1975` (second tap) and `src/LocaleDatePicker.tsx:1811` (day `commit`)
- **What is wrong:** A click whose `pointerType` is `"mouse"` returns `"mouse"` immediately. The coarse-pointer fallback never runs. Both call sites read the `click` event, not `pointerdown`. WebKit bug 282988 is still REOPENED: since Safari 18.2, a touch-generated `click` is a `PointerEvent` with `pointerType` `"mouse"`, while `pointerdown` / `pointerup` on the same tap correctly say `"touch"`. `detail` is 1, so the keyboard shortcut at the top of `activationOf` does not apply. (Pen is a separate miss, already BH-009.)
- **Why it matters:** On that Safari, a finger is classified as a mouse. The second-tap branch requires `"touch"`, so it does not run, `typingIntent` stays false, and `inputMode` stays `"none"`. The default manual-entry path never asks for the keyboard. The day-commit path calls `close(true)`, which focuses the input again; the published rule is that a finger does not get focus back. `tests/touch-keyboard.test.tsx` uses `fireEvent.click`, which builds a `MouseEvent` with no `pointerType`, so the suite takes the coarse-pointer fallback and stays green. Confirmed here by dispatching a click with `pointerType: "mouse"` while `matchMedia("(pointer: coarse)")` is true: picking a day refocuses the input.
- **How to reproduce:**
  1. On iOS Safari 18.2+ (bug 282988 still open), render the picker with the default `"second-tap"`.
  2. Tap the field. The calendar opens and `inputmode` stays `"none"`.
  3. Tap the text again. `inputmode` stays `"none"`. The keyboard is not requested.
  4. Tap a day. The dialog closes and the input is focused. A real `pointerType: "touch"` click leaves the input unfocused.

### BH-018

- **File:** `src/LocaleDatePicker.tsx:1094` (outside `mousedown` / `touchstart`) and `src/LocaleDatePicker.tsx:2021` (commit only on blur)
- **What is wrong:** Outside dismiss and typed commit are different events. The document listener closes the dialog on `mousedown` or `touchstart`. `commitTyped` runs only from the input's `onBlur` and from Enter. A `mousedown` on a node that does not take focus does not blur the input, so a finished draft is not committed and a partial draft is not rejected. The dialog is gone, focus is still in the input, and the text still shows the draft.
- **Why it matters:** The parity contract says displayed strings and committed values never disagree. After this dismiss the input shows a complete date and `value` / the echo are still the previous value (or empty). Clicking a real button does blur, so the date is committed then; clicking empty page chrome, a heading, or any non-focusable region does not. Confirmed: type `15.08.2026` into an empty picker, `mousedown` a plain `div`, the dialog closes, `onChange` is not called, the input still shows `15.08.2026`.
- **How to reproduce:**
  1. Render an empty picker. Focus the input and open the calendar.
  2. Type or paste `15.08.2026`.
  3. Press the pointer down on a non-focusable element outside the picker (not a button, link, or input).
  4. The dialog closes. `onChange` has not fired. The input still shows `15.08.2026` and remains focused. The echo is absent.

### BH-019

- **File:** `src/LocaleDatePicker.tsx:1154` (measure) and `src/LocaleDatePicker.tsx:1236` (effect dependencies)
- **What is wrong:** A portaled popover is `position: fixed` with `top` / `left` taken from `root.getBoundingClientRect()` in the viewport. Those numbers are recomputed only when `open`, `view`, `viewMonth`, or `usePortal` change, and on window `scroll` (capture) or window `resize`. Anything that moves the field without scrolling or resizing the window leaves the fixed box where it was. An in-tree popover uses `top: 100%` / `bottom: 100%` against the root, so it follows that layout. The effect also does not depend on `value`, so the echo appearing under the field (root box grows) does not remeasure.
- **Why it matters:** Checkout forms insert errors and helper text above the field while the calendar is open. The fixed calendar stays at the old viewport position and no longer sits on the field. `portal` exists so the calendar can escape a clipped container; a calendar that escapes and then detaches is the same class of miss.
- **How to reproduce:**
  1. Render with `portal`. Open the calendar and note its position against the field.
  2. Insert a tall block above the picker, or set a large `margin-top` on the root, without scrolling or resizing the window.
  3. The field moves. The dialog stays at the previous `top` / `left`.
  4. Repeat without `portal`. The dialog moves with the root.

### BH-020

- **File:** `src/LocaleDatePicker.tsx:1128` (`syncPortaledTheme`) and `src/LocaleDatePicker.tsx:1236` (effect dependencies)
- **What is wrong:** Theme tokens are copied once per measure: every computed property whose name starts with `--rldp`, plus `color-scheme`, is written onto the portaled node as an inline style. Inline styles win over the cascade. The measure effect does not depend on `themeName`, `styles`, or any ancestor class, so a later token change does not copy again until scroll, resize, or a month/view change. The in-tree popover inherits the live values and does not have this freeze. (`dir` not being copied at all is BH-013, not this.)
- **Why it matters:** `portal={true}` plus an ancestor `.dark` / `[data-theme]` / `data-rldp-theme` toggle is the documented theming model. Toggling it while the calendar is open leaves the portaled calendar on the previous colors. The stale inline values also block a later correction until the next measure.
- **How to reproduce:**
  1. Render with `portal` and a light ancestor theme. Open the calendar.
  2. Add `class="dark"` (or switch `themeName`) on an ancestor of the field. Do not scroll, resize, or change month.
  3. The field picks up the new tokens. The dialog keeps the tokens copied at open.
  4. Scroll the page. The dialog updates on the next measure.

### BH-021

- **File:** `src/styles.css:318` (border-box reset) and `src/styles.css:407` (popover width)
- **What is wrong:** The border-box reset matches `.rldp-root` and its descendants only. `portal` renders the popover with `createPortal` onto `document.body`, so that node is not under `.rldp-root` and stays `content-box`. `.rldp-popover` sets `width` / `max-width: calc(100vw - 1rem)`, `padding: 0.75rem`, and `border: 1px`. Under content-box those extras sit outside the max-width.
- **Why it matters:** The comment at `src/styles.css:309` says this reset exists because the popover's 19.5rem plus padding and border came to 330px on a 320px viewport, and `max-width` did not save it while the box was content-box. Portaling brings that overflow back. The parity contract requires the control to stay usable at 320px. In-tree, the same rules resolve to a 304px border box. Portaled, the border box is 330px and the inline `left` clamp of 8px puts the right edge at 338px, so the next-month control and the last day column run past the viewport.
- **How to reproduce:**
  1. Set the viewport to 320px wide.
  2. Render `<LocaleDatePicker portal value={null} onChange={() => {}} placeholder="dd.mm.yyyy" />` and open the calendar.
  3. The dialog's `box-sizing` is `content-box` and `offsetWidth` is 330. The right edge is past 320px.
  4. Repeat with `portal` omitted. `box-sizing` is `border-box` and the border box fits.

### BH-022

- **File:** `src/styles.css:642` (focus outline) and `src/styles.css:164` / `src/styles.css:222` (ring tokens)
- **What is wrong:** The focus rule draws an inset outline (`outline-offset` is the negative of `--rldp-focus-width`) in `--rldp-ring`. In `minimal` and `high-contrast`, `--rldp-ring` is the same `light-dark()` pair as `--rldp-accent`. The selected day (`src/styles.css:576`) and the current month/year (`src/styles.css:623`) paint `--rldp-accent` as their background.
- **Why it matters:** The ring sits on the same fill (2px inset in minimal, 3px in high-contrast), in both light and dark. Keyboard entry focuses the selected day first, so the focused cell shows no indicator. Moving to an unselected day shows a ring; moving back hides it. High-contrast is the theme whose comment promises a thicker focus indicator. `soft` and the default theme use a different ring colour, so they are not affected.
- **How to reproduce:**
  1. Render `<LocaleDatePicker themeName="high-contrast" value={new Date(2026, 6, 15)} onChange={() => {}} placeholder="dd.mm.yyyy" />`. Repeat with `themeName="minimal"`.
  2. Open the calendar and press ArrowDown so focus enters the grid on the selected day.
  3. Computed `outline-color` equals `background-color` (`oklch(0.3791 0.1378 265.52)` in high-contrast light, `oklch(0.2103 0.0059 285.89)` in minimal light). The focused selected day looks like the unfocused one.

### BH-023

- **File:** `src/styles.css:251` (`@supports` fallback) and `src/styles.css:147`, `src/styles.css:174`, `src/styles.css:205` (named themes)
- **What is wrong:** `@supports not (color: light-dark(#000, #fff))` only rewrites `--rldp-*-base` on `.rldp-root`. `minimal`, `soft`, and `high-contrast` set the public tokens to `light-dark(...)`. A custom property holds that value even when the function is unsupported. `background: var(--rldp-background, var(--rldp-background-base))` uses the fallback only when the public token is missing or guaranteed-invalid. A defined `light-dark()` value is neither, so the declaration is invalid at computed-value time and the background becomes transparent.
- **Why it matters:** The comment at `src/styles.css:231` says the fallback keeps the picker legible where `light-dark()` is unsupported, and that fine detail degrades to the plain theme. Named themes do not degrade: the field, popover, and selected day lose their opaque fill, and text inherits from the page. `themeName="default"` is unaffected because it sets those tokens to `initial`, which makes `var()` take the hex `-base` fallback.
- **How to reproduce:**
  1. Open the page in a browser without `light-dark()` (Safari before 17.5, Chrome before 123, or Firefox before 120), or substitute an unknown colour function for `light-dark()` in the named-theme tokens.
  2. Render `<LocaleDatePicker themeName="soft" ... />` (same for `minimal` and `high-contrast`) and open the calendar.
  3. The popover's computed background is transparent. An unthemed picker stays `#ffffff` via the `-base` fallback.

### BH-024

- **File:** `tests/interaction.test.tsx:207`
- **What is wrong:** "month and year navigation are two explicit grids" opens the year pill and then accepts dialog text matching `/2024|2025|2026/`. The open calendar's year pill and month title are already "2026" (value is 10 June 2026). `monthButtons` is computed and discarded (`void monthButtons`). Nothing asserts a year button, `[data-part="years"]`, or that the days grid was replaced.
- **Why it matters:** Deleting the year view (`view === "years"` renders nothing, or the year pill's `onClick` is a no-op) leaves this test green. The month half still needs 12 month labels. The year half cannot fail. The parity line this test names is "month and year navigation are two explicit grids."
- **How to reproduce:**
  1. Render as this test does (`value` 10 June 2026, `minDate` 2024, `maxDate` 2028) and open the dialog.
  2. Read `dialog.textContent` before clicking the year pill. It already matches `/2024|2025|2026/`.
  3. Remove the years branch in `LocaleDatePicker` and re-run this test. It still passes.

### BH-025

- **File:** `tests/typed-sync.test.tsx:76`
- **What is wrong:** "reopening the calendar shows the uncommitted typed month" types `10032027` over 18 July 2026, closes and reopens via trigger `mousedown`, and only asserts the grid name matches `/March 2027/`. It never checks `onChange` or that the input is still a draft. The comment says the draft stays uncommitted the whole time.
- **Why it matters:** `openPopup` prefers a parsed draft over `value`, but a committed 10 March 2027 produces the same grid name. If trigger `mousedown` (or `close`) calls `commitTyped()` before reopening, `onChange` fires, the draft is cleared, and the test still passes. The regression the name describes stays green.
- **How to reproduce:**
  1. In the trigger `onMouseDown`, call `commitTyped()` before `close()` / `openPopup()`.
  2. Re-run "reopening the calendar shows the uncommitted typed month".
  3. `onChange` receives 10 March 2027 and the input is no longer a draft, but the grid name is still March 2027, so the test passes.

### BH-026

- **File:** `tests/interaction.test.tsx:66`
- **What is wrong:** The name and the parity comment say `minDate` / `maxDate` bound navigation and do not override `shouldDisableDate`. The body only clicks 20 July (predicate blocks, no `onChange`) and 21 July (commits `2026-07-21`). Both days sit inside 1–31 July 2026. It never moves the header, never sends PageDown or an arrow past the range, and never asserts the nav buttons are disabled.
- **Why it matters:** Removing the `monthKey` clamps in `onGridKeyDown` and the `canPrevMonth` / `canNextMonth` disabled flags leaves this test green. Out-of-range months become reachable while the predicate checks still pass.
- **How to reproduce:**
  1. Make `onGridKeyDown` always apply `Arrow*` / `PageUp` / `PageDown`, and stop setting `disabled` on the header chevrons from `canPrevMonth` / `canNextMonth`.
  2. Re-run "minDate/maxDate bound navigation but do not override the predicate".
  3. The test still passes. Opening July 2026 and activating next-month shows August even when `maxDate` is 31 July 2026.

### BH-027

- **File:** `tests/keyboard-map.test.tsx:33` (and the five tests that follow, through line 111)
- **What is wrong:** "PageDown moves focus", "PageUp moves focus", both Shift+Page tests, "Home", and "End" assert only that the target `[data-day]` exists and has `tabindex="0"`. None reads `document.activeElement` after the key. `focusGridOn` checks focus only before the key.
- **Why it matters:** Roving `tabindex` is set from `focusDay` during render. DOM focus is a separate effect (`src/LocaleDatePicker.tsx:1499`). On PageUp/PageDown that effect is what focuses the new cell, because the button is not in the DOM yet when the key handler runs. Deleting the effect leaves `tabindex="0"` on the destination and drops real focus (the previous day button unmounts on a month change; on Home/End it stays on the old button, now `tabindex="-1"`). Every test in this file stays green. `tests/grid-semantics.test.tsx` does assert `document.activeElement` for ArrowDown, so this file is not backed up by that check.
- **How to reproduce:**
  1. No-op the effect that calls `btn.focus()` after keyboard navigation.
  2. Run `tests/keyboard-map.test.tsx`.
  3. PageDown still finds `[data-day="2026-6-15"]` with `tabindex="0"`, but `document.activeElement` is not that button.

### BH-028

- **File:** `tests/accessibility.test.tsx:41`
- **What is wrong:** "full keyboard path: open, navigate, commit, dismiss" sends `{ArrowRight}{Enter}` and only asserts `onChange` was called and the dialog closed. The comment says "Move one day right and commit." The committed date is never read.
- **Why it matters:** The second ArrowDown already calls `focusGridDay` on the selected day (15 July 2026). Enter commits `focusDay` even if ArrowRight does nothing, so `onChange` still fires and the dialog still closes. A broken right-arrow stays green.
- **How to reproduce:**
  1. Make the ArrowRight arm of `onGridKeyDown` return without changing `focusDay`.
  2. Run this test.
  3. It passes. `onChange` receives 2026-07-15, not 2026-07-16.

### BH-029

- **File:** `tests/touch-keyboard.test.tsx:96`
- **What is wrong:** "the keyboard is requested inside the gesture, not after it" claims `inputMode="numeric"` is already on the input when `focus()` runs inside the click handler. The expects run only after `fireEvent.click` returns. The comment says the check is synchronous and that no `act` is involved.
- **Why it matters:** Testing Library's `fireEvent` wraps the dispatch in `act()`, which flushes the `setTypingIntent` re-render after the handler returns and before `fireEvent` returns. Without `flushSync`, `focus()` still runs while the attribute is `none`, then `act` commits `numeric`. The post-conditions (`inputMode === "numeric"` and `activeElement === input`) are identical. That is the iOS failure the comment describes: the browser samples `inputMode` at `focus()` time, which this assertion never observes.
- **How to reproduce:**
  1. In the second-tap branch, replace `flushSync(() => setTypingIntent(true))` with `setTypingIntent(true)`, then `blur()` / `focus()` in the same handler.
  2. Run this test.
  3. It still passes. During `focus()`, the DOM `inputmode` is still `none`.

### BH-030

- **File:** `tests/touch-keyboard.test.tsx:141`
- **What is wrong:** "the attribute is right in the very first render, before any event" says no effect has run. `renderPicker` uses Testing Library `render`, which wraps `root.render` in `act()`.
- **Why it matters:** React's `act` flushes passive effects before `render()` returns. A first paint of `inputMode="numeric"` corrected to `"none"` in `useEffect` is what the file says must not ship (the attribute has to be right on the first tap, including SSR/hydration). This assertion sees only the post-effect DOM, so that regression stays green. `tests/ssr-contract.test.tsx` never reads `inputmode`.
- **How to reproduce:**
  1. Initialise the mode state to `"numeric"` and set `"none"` in `useEffect` when `manualEntryOnTouch === "second-tap"` and there is no typing intent.
  2. Run this test.
  3. The synchronous expect still sees `none`.

### BH-031

- **File:** `tests/anatomy.test.tsx:96` and `tests/styles-map.test.tsx:30`
- **What is wrong:** The suite header says a part with no element, or an element without its part, fails. The closed/open check only compares the set of `data-part` strings to `ANATOMY`. `rldp-day`, `x-day`, `x-day-selected`, and `styles.day` are asserted on `dayButton()` (the day button), not on `[data-part="day"]`. `rldp-input` is asserted on the textbox, not `[data-part="input"]`. `rldp-popover` and the popover inline style are asserted on the dialog, not `[data-part="popover"]`. `tests/styles-map.test.tsx` uses the same queries for input, popover, and day.
- **Why it matters:** `slotProps` exists so `data-part`, the built-in class, and the `classNames` / `styles` entry stay on one element. Moving `data-part="day"` onto a wrapper, leaving the class, `data-selected`, `data-day`, and the inline style on the button, keeps the set check green (the string `"day"` still occurs once) and keeps every class and style expect green. `[data-part="day"][data-selected]` then matches nothing. The same split works for `input` and `popover`.
- **How to reproduce:**
  1. Render `data-part="day"` on a wrapper around the day button. Leave `rldp-day`, `data-selected`, `data-day`, and `styles.day` on the button.
  2. Run `tests/anatomy.test.tsx` and `tests/styles-map.test.tsx`.
  3. Both pass. `[data-part="day"][data-selected]` matches nothing.

### BH-032

- **File:** `tests/grid-semantics.test.tsx:61`
- **What is wrong:** "names the grid with the visible month and year" opens July 2026 and asserts the grid `aria-label` contains `"2026"`. The failure message says the grid must be named with the month it shows.
- **Why it matters:** `aria-label` is `monthTitleFmt` (`July 2026` for `locale="en"`). `toContain("2026")` passes for `"2026"`, `"December 2026"`, or any other string that merely includes the year. A label with no month name stays green.
- **How to reproduce:**
  1. Set the grid `aria-label` to `String(viewMonth.getFullYear())`.
  2. Run this test.
  3. It passes while the grid name is `2026` on a July grid.

### BH-033

- **File:** `tests/announcements.test.tsx:135`
- **What is wrong:** "echoes the committed value into the trigger name" uses 17 November 2026 (`localDate(2026, 10, 17)`, `en-GB`) and asserts the trigger `aria-label` contains `"Change date"`, `"17"`, and `"2026"`. It never requires November.
- **Why it matters:** The name is `` `${changeDate}, ${fullDateFmt.format(value)}` ``. An off-by-one month (`17 October 2026`) still contains `"Change date"`, `"17"`, and `"2026"`, so a wrong accessible name stays green. This is the only assertion of that label's date. The echo exists so a month transposition is visible; this test cannot see one.
- **How to reproduce:**
  1. Build the trigger label from `changeDate` plus day and year only, or from the same instant shifted to October.
  2. Run this test.
  3. It passes.

### BH-034

- **File:** `tests/accessibility.test.tsx:107`
- **What is wrong:** "renders under dir=rtl without throwing and keeps nav chevrons" sets `dir="rtl"` on the container, opens the dialog, and asserts `querySelectorAll("svg").length >= 2`.
- **Why it matters:** The days view always contains four SVGs: previous nav, next nav, and a caret on each pill. The two carets alone satisfy `>= 2`, so removing both `[data-part="nav-icon"]` nodes stays green. Nothing asserts `dir`, a transform, or `data-part="nav-icon"`. Deleting `setAttribute("dir", "rtl")` also stays green. Locale `ar` is not shown to change layout.
- **How to reproduce:**
  1. Remove the `dir="rtl"` line and stop rendering `ChevronLeft` / `ChevronRight`.
  2. Run this test.
  3. It passes because the two pill carets remain.
