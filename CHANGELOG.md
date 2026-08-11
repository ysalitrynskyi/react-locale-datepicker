# Changelog

## 0.4.0 — 2026-08-11

Prompted by an adoption audit from a live travel-insurance checkout (34
locales, cross-origin `/embed`, payment path under GDPR). The package was
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
