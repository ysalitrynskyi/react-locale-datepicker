# Changelog

## 0.6.0 — 2026-10-01

Fixes for an external review that filed 86 findings in one day; every one was
reproduced or checked against the code before it was fixed. The ledger, with
the commit for each finding, is
[`docs/bug-hunts/2026-09-30.md`](docs/bug-hunts/2026-09-30.md).

**This release changes behaviour you can see.** No prop is removed and every
existing prop keeps its meaning, but the keyboard and focus model, some
colours and some accessibility attributes are different. Below 1.0 the minor
number is the breaking slot (`^0.5.1` does not accept 0.6.0), so nobody gets
this without choosing to. Read *Changed* before upgrading.

### Changed

- **Enter submits the form** when the calendar is closed and nothing has
  been typed. It used to be swallowed in every state, so a form with the
  picker in it could not be submitted from that field.
- **Tab closes the calendar and moves on; ArrowDown enters it** (D21). The
  field and its calendar are one widget, like a combobox and its popup. Tab
  used to walk into an in-tree calendar and skip a portaled one, leaving it
  open. Tab out of a portaled calendar's last control returns to the page
  order after the field, and Shift+Tab out of its first returns to the
  field.
- **`onBlur` fires once, when focus leaves the widget**, and the typed draft
  commits at that moment. It used to fire on every input blur: moving into
  the calendar, the second tap's refocus and Tab into the header each ran
  the parent's validation in the middle of an interaction. Leaving the
  widget also closes the calendar.
- **Escape is marked handled** (`preventDefault`), so a surrounding native
  `<dialog>`, or a modal library that checks `defaultPrevented`, closes the
  calendar only.
- **The post-pick click guard is scoped to the calendar's footprint.** For
  350 ms after a day was picked it used to cancel every click on the page,
  including Submit and the next field, and it outlived the component. It now
  swallows only a click inside where the calendar was, only after a pointer
  pick.
- **The calendar icon uses `aria-disabled`, not `disabled`**, when the field
  is disabled, so a press on it reaches `onDisabledOpenAttempt`. CSS that
  targets `.rldp-trigger:disabled` should target `[aria-disabled="true"]`.
- **One numbering system per widget** (D20). Under `ar` or `fa` the echo and
  the month title used the locale's digits beside a year pill and day cells
  in Latin digits. Every formatter now writes Latin digits unless the tag
  asks for a system (`ar-u-nu-arab`), and then all of them use it.
- **Only the first letter is upper-cased** in the echo, the month pill and
  the months view, using the locale's rules. `text-transform: capitalize`
  is gone; it upper-cased every word ("Miércoles, 17 De Junio De 2026").
- **Accessibility attributes moved.** `aria-expanded` is on the trigger
  (with `aria-haspopup` and `aria-controls`), not on the textbox, which does
  not support it. The trigger's name leads with the field's `aria-label`
  ("Start date, Open calendar"). The dialog is labelled by the visible
  month and year when there is no `aria-label`. The echo is `aria-hidden`.
  Tests that query these by role and name may need updating.
- **Text and rings meet WCAG AA on every shipped theme.** Changed: the placeholder
  (now the faint token), faint text in dark mode, the default theme's light
  error border and today ring, its dark selected-day pair and hover, the
  today ring in the minimal and soft themes, the soft theme's dark hover,
  and the focus ring on a filled cell. The values
  are in [`docs/THEMING.md`](docs/THEMING.md). Overridden tokens are
  untouched.
- **`.dark` and `.light` resolve to the nearest ancestor.** A dark card on a
  `.light` page used to stay light, because the later of two descendant
  rules always won.
- **The compact 36px field applies only with a fine pointer**, so a touch
  tablet keeps the 16px text (mobile Safari zooms on focus below that) and
  44px targets.
- **Typed input never commits a date nobody typed.** An edit inside a
  complete date keeps its separators as boundaries (inserting a digit used
  to re-flow "15.03.2026" into "11.05.0320"); a fourth group is rejected
  instead of joining the year; a year-first paste such as `2026-07-17` is
  reordered; the Arabic, CJK fullwidth and ideographic separators separate.
- **The draft follows the value.** A new `value` from the parent,
  `form.reset()` and `disabled` each drop the typed draft instead of letting
  the next blur write it back. A disabled field closes its calendar.

### Added

- `direction?: "ltr" | "rtl" | "auto"` (D19). Omitted, the picker inherits
  the page's direction as before; `"auto"` takes it from the locale. The
  calendar carries the resolved direction, so a portaled calendar matches
  its field, and an ancestor `dir="auto"` that resolves right-to-left now
  flips the arrows and chevrons too.
- `id` and `aria-labelledby`, forwarded to the input: the way to label the
  field without wrapping it in a `<label>`.
- Month and year options have one tab stop and an arrow-key map (Home/End,
  PageUp/PageDown), and the open month and year carry `aria-current`.

### Fixed

- Years 0 to 99 were read as 1900 to 1999; years below 1000 displayed in a
  form the field could not read back; a `Date` from another realm (an
  iframe) was ignored; a `Date` near the edge of the representable range
  crashed the header; the year list could omit the open year.
- `resolveLocale("UA")` and `"ua-UA"` formatted in the host's language
  instead of Ukrainian.
- Japanese, Chinese and Korean day names lost their unit characters
  ("31 土曜日 1 2026"); the echo and calendar now carry `lang`.
- A chevron left the keyboard cursor on the previous month's date; opening
  with nothing chosen could land on a month with no selectable day; a
  predicate that changed while open left the grid without a tab stop.
- Switching to the month or year view dropped focus on `<body>`.
- Opening the year list scrolled the page.
- A press outside committed a finished draft only when its target took
  focus. Closing from the icon left focus in the calendar. A press on the
  field's padding did nothing.
- A portaled calendar fell behind its field after a layout change above it,
  kept a stale theme, missed the field's font and the border-box reset, and
  could open with its top off-screen.
- In right-to-left layouts the calendar now opens from the field's start
  edge.
- Safari 18.2+ reports a touch click as a mouse (WebKit bug 282988); the
  pointer type is read from the `pointerdown` of the same tap.
- Clearing a field that still had a value reported it missing; a throwing
  `shouldDisableDate` wiped the typed text and skipped `onBlur`; IME
  composition was masked mid-composition.
- An empty string in `labels` left a control unnamed.
- Forced-colours mode lost the field's focus cue and drew disabled days as
  enabled; selected and current cells printed without their fill; a
  selected day the predicate rejects keeps its fill; named themes kept
  invalid tokens where `light-dark()` is unsupported; 200% text at 320px
  scrolled the page sideways.

### Tests

- 298 unit tests (185 before) and new real-browser guards in
  `e2e/bughunt.spec.ts` and `e2e/bughunt-styles.spec.ts`.
- Twelve findings were existing tests that passed with the behaviour they
  named deleted. Each was rewritten and seen to fail against the broken
  code.
- `npm run typecheck` now covers the tests and e2e (`tsconfig.test.json`).

## 0.5.1 — 2026-08-12

### Fixed

- **iOS Safari: the second tap could do nothing.** 0.5.0 raised the keyboard by
  flipping `inputMode` and then blurring/refocusing the input from a
  `requestAnimationFrame`, so the attribute would be committed before focus
  returned. But iOS honours a programmatic `focus()` only while it is still
  processing the gesture that caused it, and a rAF callback is outside that
  window — Safari declines silently, and the tap that asks to type does
  nothing at all. Worse than the bug 0.5.0 fixed, for the platform most likely
  to hit it.

  Both halves now run inside the click handler: `flushSync` commits
  `inputMode="numeric"` to the DOM, then blur/focus follows synchronously. The
  ordering constraint is unchanged — focus must arrive *after* the attribute
  lands, or the browser re-reads `none` and shows nothing.

  Guarded by a test that asserts focus has landed by the time the handler
  returns, rather than that it eventually lands; reverting to the rAF form
  turns it red.

## 0.5.0 — 2026-08-12

Three defects a desktop cannot show you. All reported from a phone on a live
checkout, all invisible to the 172 tests that existed before this release,
because jsdom reports no pointer at all and every one of these is
touch-only.

### Changed

- **The on-screen keyboard no longer appears on the first tap of the field.**
  New prop `manualEntryOnTouch`, default `"second-tap"`. The field carries
  `inputMode="none"` until the visitor taps the *text* a second time while the
  calendar is open — the one unambiguous signal that they want to type rather
  than pick. `"immediate"` restores the previous behaviour.

  Typing is never removed: `inputMode` governs only the virtual keyboard, so a
  hardware keyboard, paste, and every a11y affordance work throughout. On a
  phone the keyboard costs about half the viewport, and it was appearing for the
  majority of taps that only ever wanted the grid.

  The attribute is rendered unconditionally rather than behind a pointer check,
  because on a device with a physical keyboard it does nothing observable — and
  that is what keeps the server and client markup identical. It matters more
  than it sounds: the very first tap is the one that must not raise a keyboard,
  so anything decided after mount is decided too late. A `useSyncExternalStore`
  version of this passed every test and then left the attribute at `numeric`
  through the whole first tap on the real page.

  What *is* judged per interaction is the activation itself, read from
  `PointerEvent.pointerType` on the event rather than from a media query about
  the device — `(pointer: coarse)` describes the primary pointer, so a
  touchscreen laptop driven by its trackpad and the same laptop driven by a
  finger are indistinguishable to it, and those two want opposite handling.

### Fixed

- **Picking a day raised the keyboard.** `commit()` returned focus to the text
  input unconditionally, and on touch, focusing a text input *is* a request for
  the keyboard. So the tap that selected a date — the tap that exists precisely
  so nobody has to type — closed the calendar and threw a keyboard over the
  form. Focus is now returned for every activation except a finger: keyboard
  and assistive tech (`detail === 0`, or Enter/Space handled by the grid) and
  mouse or pen, where there is no virtual keyboard to raise and dropping the
  user on `<body>` would be its own regression. APG's return-focus contract is
  preserved for everyone it was written for.

- **The calendar changed sides mid-interaction.** The above/below decision was
  re-made on every scroll and resize frame. Opening the keyboard shrinks
  `window.innerHeight` by roughly half, which collapses `spaceBelow` and flips
  a calendar the visitor is reading over the top of the field, on the frame
  their keyboard appears. Reported verbatim as "the calendar goes up and looks
  weird". The side is now decided once per open and frozen until close;
  coordinates keep updating, so the popover still tracks the field through
  scrolling and layout changes.

### Added

- `tests/touch-keyboard.test.tsx` — 12 tests covering all three, with a
  `matchMedia` stub for pointer type. Each guard was verified by reverting the
  fix it protects and confirming the suite goes red. The flip test failed that
  check on its first attempt: it shrank the viewport to a height that would not
  have flipped anyway, so it passed with the fix deleted. Both viewport
  constants now carry the arithmetic in a comment.

## 0.4.1 — 2026-08-12

Documentation only. No runtime, type or stylesheet change; `0.4.0` and
`0.4.1` are byte-identical in `dist/`.

### Documented

- **Tailwind preflight overrides the package's own styling, and the cascade
  layer is why.** The stylesheet's guarantee — every rule inside
  `@layer rldp`, written with `:where()`, so unlayered consumer CSS always
  wins — was documented as a benefit only. A CSS reset is unlayered consumer
  CSS too and wins on identical terms, and layer order is resolved *before*
  specificity, so preflight beats `@layer rldp` even where the package rule
  is the more specific of the two. Verified in a browser: a rule at 0,1,0
  inside a layer loses to an unlayered `button` selector at 0,0,1.

  Preflight resets `color`, `font-size` and `background-color` on
  `button, input, …` and `border-width` on `*`, which covers the field and
  every day cell. The three failures this produced on a live checkout, none
  of which throws or looks wrong in a default light theme in English: a
  dark-mode field painted dark while the host's near-black text stayed on it
  (the date the buyer had just typed, invisible); disabled days rendered
  pixel-identical to selectable ones because `--rldp-disabled-foreground`
  never applied; the field lost its border and read as a different control
  from the inputs beside it.

  README gains the rule to work from — anything this package styles on a
  `<button>` or an `<input>` needs an explicit class from the consumer — the
  collision table, and the alternative fix of ordering Tailwind into a layer
  below `rldp`. `docs/THEMING.md` now states the cost beside the guarantee
  instead of the guarantee alone.

## 0.4.0 — 2026-08-11

Prompted by an adoption audit from a live multilingual checkout (dozens of
locales, framed cross-origin, payment path under GDPR). The package was
already a behavioural superset of that product's in-house picker; this
release turns the behaviours that checkout bets on into a **published
contract**, and adds the one escape the audit could not resolve from the
outside.

### Added

- **`portal?: boolean | HTMLElement`** (decision D17). Opt-in escape from
  `overflow: hidden` ancestors. Default stays the in-tree
  `position: absolute` popover (identical to 0.3.x layout). `true` portals
  to `document.body` with `position: fixed` coordinates measured from the
  field; an element portals into that host. Keyboard model, Escape-to-close
  and outside-click close keep working; theme tokens are copied onto the
  portaled node. Observed clip without portal in the harness: dialog
  ~282px tall inside a 72px overflow card, only ~90px visible.
- **Consumer-contract regression suite** pinning, for anyone on a money
  path: `resolveLocale("ua") === "uk"` and never-throw / malformed→`"en"`;
  committed values are local midnight (suite also runs under
  `Asia/Kathmandu`, a non-hour offset); no `localStorage`/`sessionStorage`
  in source; SSR import + `renderToString` with no `window`/`document`;
  display format fixed `dd.MM.yyyy` across locales (not locale-derived).
- README section on **labels**: `previousMonth`/`nextMonth` are
  Intl-derived when omitted; the four English defaults
  (`keyboardHelp`, `openCalendar`, `changeDate`, `closeCalendar`) **must**
  be overridden for a non-English UI, with a worked Ukrainian example.
- README / API / D17 documentation of the portal escape and the overflow
  finding.

### Fixed

Found in review of the portal work, before it reached the registry.

- **A portal host from another realm was silently ignored.** The host check
  used `instanceof HTMLElement`, which answers "was this built by *this*
  realm's constructor" rather than "is this an element". An element from an
  iframe, a popup window, or a consumer's second jsdom document failed it and
  the popover fell back to rendering in-tree — reappearing as the clipping the
  caller used `portal` to escape, with nothing logged to explain it. Host
  detection is now duck-typed (`nodeType === 1` plus `appendChild`), so it is
  realm-independent. A truthy non-element (a ref object, a stray value from
  consumer state) still degrades to in-tree instead of reaching `createPortal`,
  and that case is now pinned by a test.
- **Portaled repositioning forced layout on every scroll event.** The
  capture-phase scroll listener called a measure that reads
  `getBoundingClientRect`, `offsetHeight` and `offsetWidth` — three forced
  layouts — and scroll fires far more often than once per frame on a touch
  device. Coalesced to one measure per animation frame, which is the most a
  paint can show anyway, with the pending frame cancelled on unmount. Matters
  because the package's stated home is checkout forms, where jank during a
  scroll is very visible.

### Added (review follow-ups)

- SSR contract now exercises **`portal: true`**, not just the default. The
  portal branch resolves `document.body` during render; that guard existed but
  was asserted only in a comment, so a regression in the opted-in path — the
  one a clipping checkout is most likely to use — would have shipped green.
- Contract test for a host belonging to another document. It states its own
  limit honestly: jsdom's `createHTMLDocument` makes a second document but not
  a second realm, so it cannot distinguish duck-typing from `instanceof`; only
  a real iframe would, and that belongs in e2e.

### Why a minor, not a major

Additive optional prop; default layout behaviour is unchanged. A consumer
that never sets `portal` sees 0.3.x stacking. Changing the default to
always-portal would have been a major.

## 0.3.3 — 2026-07-26

### Fixed

- **A Cyrillic keyboard could turn one date into another.** On a ЙЦУКЕН
  layout the physical period and comma keys emit `ю` and `б`. The mask
  dropped them as letters, so the digits around them closed up: `1ю8ю2026`
  became `18.20.26` instead of `01.08.2026`, and a space did the same. Only
  single-digit days and months were affected, which is why it stayed
  invisible. `ю`, `б` (both cases) and whitespace are now separators.

  This stays an allowlist on purpose. "Any non-digit separates" breaks
  mid-string editing, where interleaved junk must be stripped so the digits
  close up; the existing test caught that version.

### Pinned

- `tests/ukrainian-input.test.tsx` locks down behaviour that was already
  correct: `today` derived in `Europe/Kyiv` rather than the host zone, the
  legacy `Europe/Kiev` spelling, an invalid zone falling back instead of
  throwing, the `ua` alias, and Ukrainian month names from `Intl`.

## 0.3.2 — 2026-07-26

Bug-fix release from an external review of 0.1.0. No API change.

### Fixed

- **An unusable `Date` crashed the host tree.** `new Date("nope")` makes
  every `Intl.DateTimeFormat.format()` call throw, and thrown during render
  that unmounted everything above the picker. Every `Date` prop (`value`,
  `today`, `defaultCalendarMonth`, `minDate`, `maxDate`) is now normalized
  at the boundary; an unusable one is treated as no date, and an unusable
  bound as no bound.
- **The popover overflowed a 320px viewport.** The stylesheet never set
  `box-sizing`, so the popover measured 330px. A border-box reset scoped to
  the component's own subtree brings it to 304px with 8px clear each side.
- **The picker rendered transparent where `light-dark()` is unsupported**
  (Safari < 17.5, Chrome < 123, Firefox < 120). An `@supports not` block
  restores the ten tokens that decide whether the component can be read and
  operated.

## 0.3.1 — 2026-07-26

Prompted by a field report against a consumer product whose users could not
enter birth dates before the Unix epoch. This package never had an epoch
floor — a new regression suite now pins that permanently — but the audit
surfaced one real gap and fixed it.

### Fixed

- An Invalid Date (`new Date("nope")`, or `new Date(x)` where `x` arrived
  null or malformed from an API) passed as `value`, `today`,
  `defaultCalendarMonth`, `minDate` or `maxDate` crashed the consumer's
  whole tree with `RangeError: Invalid time value` thrown from render. All
  five Date props now normalize at the boundary: an unusable Date behaves
  exactly like an absent one, and a regression suite pins every prop.
- The component was measured content-box, so the popover's declared
  19.5rem plus padding and border came to 330px on a 320px viewport and
  overflowed. A border-box reset now applies, scoped to the component's own
  subtree with `:where()` so it cannot leak into consumer markup and stays
  overridable.
- Without an explicit `minDate`, the year grid started at the current year,
  quietly making past years unreachable through the year view (month
  navigation and typed entry were never limited). It now spans 120 years
  back — the span birth-date dropdowns conventionally offer — and the years
  view scrolls itself to the current year when it opens. Selection stays
  governed solely by `shouldDisableDate`.

### Added

- A pre-epoch regression suite: 1967 dates type, parse, commit, click and
  navigate like any other date, and the year grid reaches 1900 when
  `minDate` asks for it.

## 0.3.0 — 2026-07-26

Driven by operator testing of the 0.2.0 live demo: the typed-input path and
the open calendar lived in separate worlds, and "today" could not follow a
business timezone.

### Fixed

- Typing a complete date while the calendar is open now navigates the grid
  to it live (clamped by `minDate`/`maxDate` like every other navigation
  path), with the roving target following and DOM focus staying in the
  input. Previously the grid ignored typing entirely.
- Reopening the calendar honours an uncommitted typed draft: the view opens
  on the month just typed instead of the stale committed value.
- Separator keystrokes are accepted instead of silently stripped. `.` `,`
  `/` `-` and the Arabic (U+060C) and ideographic (U+3001) commas close the
  current segment and pad a single-digit day or month, so `1.7.2026` masks
  to `01.07.2026`. Pure-digit typing masks exactly as before, under a
  regression guard.

### Added

- `timeZone` prop (decision D16): derive "today" — the ring, the default
  view month, the default keyboard target and the default year range — in a
  fixed IANA zone, for availability rules that run on a seller's calendar
  day while visitors sit up to a whole day away. `"default"` and `"system"`
  mean the visitor's own zone; invalid names fall back to it. Committed
  values remain local-midnight `Date`s — this never converts the value.
- `today` prop: inject "today" outright. Wins over `timeZone`. For
  deterministic tests, screenshots, and rules not anchored to wall clocks.
- `todayInTimeZone(timeZone)` export, so `shouldDisableDate` can be built
  on the same business day the component's marker uses.

## 0.2.0 — 2026-07-26

Additive. No API was removed or renamed, and every new capability is opt-in
with 0.1.0 behaviour as the default — except the accessibility corrections
listed below, which change defaults deliberately and are called out per the
roadmap's rule for them.

### Added

- **Published anatomy.** `data-part` on every rendered element, driven by one
  exported `ANATOMY` list that also types `classNames` / `styles` and
  generates `docs/ANATOMY.md`. Completes the headless escape hatch.
- **Four named themes** — `default`, `minimal`, `soft`, `high-contrast` —
  as `[data-rldp-theme]` blocks, plus a `themeName` prop that stamps the same
  attribute. Themes nest; the nearest one wins.
- **`styles` prop**: per-slot inline styles, keyed exactly like `classNames`,
  including the state slots.
- **`labels` prop**: the four strings `Intl` cannot supply. Navigation labels
  stay Intl-derived; `labels` entries for them are overrides only.
- **Opt-outs** with today's behaviour as the default: `showEcho`,
  `showWeekdayHeader`, `showTodayMarker`.
- **`onValidationError(reason)`** for typed input — `"missing"`,
  `"impossible-date"`, `"not-selectable"`. The component reports; the
  consumer renders. `hasError` stays visual-only.
- **Tailwind v4 bridge** documented in `docs/THEMING.md`, both directions.
- **Demo** in `examples/`, consuming the built package.
- New exports: `ANATOMY`, and the types `Part`, `PartSlot`, `Labels`,
  `ThemeName`, `ValidationErrorReason`.

### Accessibility corrections

Default behaviour changes, called out per the roadmap's rule for
accessibility fixes.

- The day grid now uses **`role="grid"` semantics** with `aria-selected` on
  the gridcell. `aria-current="date"` moves from the selection to **today**,
  which is what it means.
- Weekday cells become **`columnheader`s** announced with the long weekday
  name. They were `aria-hidden="true"`, which hid the column semantics.
- The calendar trigger was **`aria-hidden="true"`** and is now named, and
  restates the committed date ("Change date, 17 November 2026"). It stays out
  of the tab order.
- The month/year live region gained `aria-atomic="true"`, so a reader no
  longer announces a bare year on a year-crossing navigation.
- The APG one-time keyboard help is announced when focus first enters the
  grid.

### Fixed

- **Tokens set on an ancestor were silently ignored** — the behaviour
  `README.md` documented since 0.1.0. The stylesheet declared every token on
  the picker root, and an element's own declaration beats an inherited value
  regardless of cascade layer. Ancestor overrides now work, which is also
  what makes themes nestable.
- **Typed digits worked for only two numbering systems.** Users whose locale
  defaults to `beng`, `deva`, `mymr`, `thai` and others could not type a date
  at all: their digits matched no range and were then stripped. The digit map
  is now generated from `Intl.NumberFormat`.
- The responsive density media query set the public `--rldp-cell-size`, so a
  consumer override only applied below the breakpoint. It now sets the
  built-in default.

### Changed

- Palette authored in `oklch()`. Verified as a visual no-op: zero solid-fill
  pixels changed across the README captures; only antialiased glyph edges
  move, by one 8-bit step.

## 0.1.0 — 2026-07-26

First public release.

### Features

- `LocaleDatePicker` React component with local-midnight `Date` values
- `resolveLocale` export (`ua` → `uk`, safe fallback for malformed tags)
- Self-contained stylesheet at `react-locale-datepicker/styles.css` with
  `--rldp-*` tokens, light/dark (OS + class/attribute), RTL, forced-colors
  and reduced-motion basics
- `className`, `classNames` (slot overrides) and `icons` props
- Masked `dd.MM.yyyy` typing with Eastern Arabic-Indic digit normalization
- Long-form echo pinned to the Gregorian calendar (agrees with the grid)
- Full keyboard map: arrows, Page/Shift+Page, Home/End, Enter/Space, Escape
- Day-cell accessible names lead with the day number (voice-control safe)
- Dual package: ESM + CJS + TypeScript declarations; `"use client"` banner
  for RSC consumers

### Quality

- Vitest + Testing Library parity-contract suite (timezone matrix in CI)
- Playwright: Chromium / Firefox / WebKit × 320 / 768 / 1280
