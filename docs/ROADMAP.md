# Feature and theming roadmap

Where the component goes after the extraction plan in [`PLAN.md`](PLAN.md) is
complete. This document is a proposal: it commits to directions, not dates, and
every priority in it is revisable by the operator. Nothing here starts before
the extraction phases finish — the port, styling, tests, packaging and first
publish described there (some of which run in parallel) come first.

Grounded in a survey of the market run on 2026-07-26 against the then-current
official documentation, repositories and npm registry statistics of the
libraries named below. Figures and competitor claims describe that date, not
timeless truths; download counts were verified against the npm API at the
time of writing.

---

## Market position

What the incumbents did as of the survey, and where that leaves us.

| Library | Status at survey | Locale data | Theming | Accessibility | Runtime deps |
|---|---|---|---|---|---|
| react-day-picker v10 (43.3M downloads/week) | Active | date-fns locale bundles | `--rdp-*` variables, no shipped dark theme | Strong, ARIA grid | date-fns |
| react-datepicker v9 (5.0M downloads/week) | Active | date-fns, manual registration | Build-time SCSS variables only | Long-open announcement gaps | date-fns, clsx, floating-ui |
| MUI X Date Pickers (5.3M downloads/week) | Active | Adapter over dayjs/date-fns/luxon/moment | MUI theme system | Strong field model; RTL bug history | @mui/material + Emotion + date lib |
| React Aria Components | Active | **Intl-derived** | Unstyled | Best in class | @internationalized/date |
| Mantine Dates | Active | dayjs bundles | `--mantine-*`, provider-bound | Documented but app-supplied labels | dayjs, @mantine/core |
| Ant Design | Active | dayjs + antd locale files | Token algorithms | No accessibility documentation at survey time | dayjs, antd |
| flatpickr (1.85M downloads/week) | Frozen since 2022 | 67 hand-written locale files | 8 static theme files | Structurally mouse-driven | none |
| Vanilla-Calendar-Pro | Active | Intl for names only | light/dark/system attribute | Undocumented depth | none |
| Duet Date Picker (36k downloads/week) | Archived 2024 | Hand-supplied strings per locale | `--duet-*` variables | Excellent, audited | none |
| Cally (24k downloads/week) | Active; calendar grid only, no input | Intl for names | Two variables + Shadow Parts | Excellent | one |

Conclusions the roadmap is built on:

1. **None of the surveyed libraries ship full Intl derivation.** React Aria
   comes closest but requires its own value types and library.
   Vanilla-Calendar-Pro and Cally derive names from Intl but hand-set the week
   start. Deriving names, week start, echo and (eventually) digits and
   calendar systems from Intl with plain `Date` values and zero dependencies
   is a position none of them occupies.
2. **Typed input is the surveyed set's collective blind spot.** Masked numeric
   entry with digit-script normalization exists in none of them in usable
   form; MUI's Arabic-Indic keyboard editing had been broken and unassigned
   since 2024 at survey time.
3. **The accessibility flagships are gone.** Duet is archived with a stranded
   user base; flatpickr is frozen; Ant Design's date picker had no
   accessibility documentation as of the survey. The converged APG
   keyboard/announcement model is well documented and mostly unimplemented in
   maintained pickers.
4. **Free range selection is a market gap.** MUI paywalls every range picker
   ($299/year/developer at the time of the survey), and users cite this as
   their reason to switch.
5. **Base UI — at survey time the default primitive layer for shadcn/ui — has
   no date picker.** A styled-but-themeable component that follows the shadcn
   token vocabulary and exposes a headless styling contract lands in that gap.
6. **API stability is sellable.** MUI shipped four breaking majors in four
   years; react-day-picker removed APIs at each major. A published component
   that commits to stability differentiates on trust.

---

## Principles that bound every item below

- **Zero runtime dependencies**, permanently. Features that would require a
  dependency are reshaped until they do not, or rejected.
- **Plain local-midnight `Date` values** stay the public contract. No custom
  date types. A Temporal adapter can be added alongside, never instead.
- **The parity contract in [`EXTRACTION.md`](EXTRACTION.md) is inviolable.**
  Every behaviour there survives every feature below, and the test suite from
  Phase 3 must stay green throughout.
- **Everything is optional.** Every new capability is an opt-in prop or an
  optional import. Defaults change only in two named cases, and each such
  change is called out in release notes: accessibility corrections (for
  example the day-name fix in Track 5), and pre-1.0 visual defaults while the
  Phase 2 restyle is still settling. After 1.0, defaults are frozen.
- **Intl first.** Any data Intl can supply is derived, never bundled. The
  hand-maintained strings are only those Intl cannot produce — keyboard help,
  the selected-date announcement prefix, a close label — exposed through a
  `labels` prop with English defaults. Strings Intl already supplies today
  (for example the navigation buttons, labelled with the Intl-formatted
  target month) keep their derived defaults; `labels` entries for them are
  overrides only.
- **One-tap commit stays the default.** Escape hatches may be added
  (`shouldCloseOnSelect`), but the default never grows a confirm step.

---

## Track 1 — Theming, dark mode and styles

The superset of decision D3, sequenced first because everything visual builds
on it. This is the consensus architecture observed across the survey for a
zero-dependency component that ships its own stylesheet.

### Token architecture

- Every visual decision routed through prefixed CSS custom properties
  (`--rldp-*`), defined on the component root class — never `:root` — so two
  differently themed pickers coexist on one page.
- Semantic pair naming following the shadcn vocabulary consumers already know:
  `--rldp-background` / `--rldp-foreground`, `--rldp-accent` /
  `--rldp-accent-foreground`, plus component knobs (`--rldp-cell-size`,
  `--rldp-radius`, `--rldp-z-index` — popover stacking is a real integrator
  pain point Duet solved this way).
- Palette authored in `oklch()` so dark variants and hover shades derive
  predictably.
- The whole shipped stylesheet wrapped in `@layer` and written with `:where()`
  so consumer CSS always wins regardless of import order.
- A published **anatomy**: one canonical list of named parts (input, trigger,
  popover, header, nav, grid, weekday, day, echo, ...) drives three things at
  once — the `classNames` override map, a `data-part` attribute on every
  rendered element, and the documentation. State exposed as data attributes
  (`data-selected`, `data-disabled`, `data-today`, `data-outside-month`,
  `data-open`), so consumers who discard the stylesheet entirely still get a
  complete, documented styling contract. This is the headless escape hatch:
  unstyled mode is simply "do not import the stylesheet".
- A one-line documented Tailwind v4 bridge (`@theme inline` alias) so utility
  users can map our tokens without any shipped Tailwind.

### Light and dark mode

- Default follows the operating system with **CSS only**: `color-scheme:
  light dark` plus `light-dark()` color values. No JavaScript, no flash of
  wrong theme, works during SSR. This lands with the Phase 2 restyle, i.e.
  pre-1.0, and is called out in release notes as a visual-default change.
- App override via the nearest ancestor class or attribute — honouring both
  `.dark` and `[data-theme="dark"]` (and their light counterparts) for
  compatibility with next-themes, daisyUI-style theming and hand-rolled
  togglers. The rule learned from Radix: a stylesheet-shipping component reads
  a class or attribute; it does not take the resolved theme as a prop.
- A convenience `theme` prop (`"light" | "dark" | "auto"`, default `"auto"`)
  for consumers without a theming system, implemented as the same attribute.
- Each theme sets `color-scheme` so native scrollbars and controls match.
- Documentation includes the consensus pre-paint `localStorage` +
  `matchMedia` snippet for app-level toggles; we do not ship the script.

### Shipped themes

A small curated set, each a block redefining the same token list under
`[data-rldp-theme="<name>"]`, nestable per element, and equally selectable
from React via a `themeName` prop (`"default" | "minimal" | "soft" |
"high-contrast"`) that stamps the same attribute — the attribute path stays
for CSS-only consumers, the prop satisfies configuration-through-props users:

- **default** — the light/dark pair described above;
- **minimal** — borderless, flat, typography-led;
- **soft** — larger radii, filled surfaces;
- **high-contrast** — WCAG AAA contrast targets, thicker focus indicators.

react-day-picker ships no dark theme at all and consumers hand-roll one — a
recurring community question there; shipping real themes is a visible
differentiator at near zero marginal cost once the token layer exists.

### Density, size and robustness

- Day cells keep today's responsive sizing as the default (44px touch
  targets, 36px on fine pointers), never below the WCAG 2.2 SC 2.5.8 floor of
  24px; any default size change before 1.0 is a release-note item. A `size`
  prop plus container query support (`container-type: inline-size` on the
  root) lets the picker compact itself where space is constrained.
- **Forced-colors support** (Windows Contrast Themes): selection and focus
  drawn with borders and reserved padding so state survives when backgrounds
  and shadows are stripped. None of the surveyed pickers handles this; the
  recipes are documented in the APG example and GOV.UK frontend.
- **Reduced motion**: every open/close/month transition gated behind
  `prefers-reduced-motion`. Duet animates unconditionally; we will not.

---

## Track 2 — Customization and integration API

Ordered by expected demand, informed by which escape hatches the incumbents'
users actually use.

- **Display format contract** — the most universal setting across every
  surveyed input-bearing picker and currently absent: the format is fixed
  `dd.MM.yyyy`. Plan: (a) an opt-in locale-derived numeric format (order and
  separator from `Intl.DateTimeFormat.formatToParts`), (b) a `format`
  override, (c) a parse/format function pair as the full escape hatch
  (Duet's `dateAdapter` seam). Every option must re-derive the mask, which
  the parity contract protects, so this work is gated on the Phase 3 masking
  test coverage and on D17. The `placeholder` prop stays caller-supplied
  regardless — it must always match whatever format is active.
- **Opt-outs for the existing built-ins.** The optional-settings principle
  has to run backwards too: audit each current built-in and expose it as an
  opt-out with today's behaviour as the default — the long-form echo
  (`showEcho={false}` for consumers with their own field layouts), the
  weekday header, the today marker, and input masking (for consumers who
  want free typing against their own parser). Each opt-out is a boolean or
  slot-level `null`, never a behaviour change for existing callers.
- **`classNames` and `styles` maps** typed against the published anatomy
  (Phase 2 / D3 already plans `classNames`; `styles` completes it).
- **`icons` prop** to substitute the four built-in SVGs (deferred from D4).
- **`labels` prop** covering the strings Intl cannot supply, as bounded in
  the principles section. Duet needed roughly thirteen such strings per
  locale; ours is a handful because Intl supplies month, weekday, echo and
  navigation text.
- **Slot components** for coarse substitution (header, footer, day cell) — a
  deliberately small set, not react-day-picker's 26. Two-tier day
  customization copied from Mantine's cleanest-in-market design: `renderDay`
  for content-only, `getDayProps` for full control.
- **Footer utilities**: an optional today/clear action row, and a `footer`
  slot that doubles as a polite live region for announcements.
- **Controlled and uncontrolled state**: `open` / `onOpenChange` /
  `defaultOpen`; `defaultValue` for uncontrolled use alongside the current
  controlled pair; `shouldCloseOnSelect: boolean | (() => boolean)` with the
  current one-tap commit as the unchanged default.
- **`clearable`** input affordance (the component never self-clears today;
  this stays opt-in, and the typed-clear behaviour — typing never commits
  null, recorded in the source comments at `commitTyped` — is untouched).
- **Native input surface**: forward or model `id`, `autoFocus`, `required`
  (wired to the hidden form input below), `inputMode`, and an
  `inputReadOnly` mode meaning "calendar-only entry, no typed input,
  suppress the mobile keyboard" — distinct from `disabled`, and it must not
  disturb the masking contract when off.
- **Popover placement and escape from clipping.** Two separable mechanisms,
  both zero-dependency. Placement: the flip-above and shift-into-viewport
  measurement the component already performs, kept and documented, plus a
  `placement` prop for forcing a side, with CSS anchor positioning as the
  implementation once support allows. Clipping escape: the native Popover
  API's top layer as the opt-in default mechanism, with `portalContainer`
  (element or id) as a separate explicit mechanism for callers who need the
  popup inside a specific DOM subtree — the Popover API cannot target an
  arbitrary container, so the two are distinct options, not one. Until this
  ships, clipping inside `overflow: hidden` ancestors is a documented
  limitation ([`TESTING.md`](TESTING.md) scopes its pre-publish test
  accordingly).
- **Standalone `<Calendar>` export** — the grid without input or popover, for
  inline use. Cally proves the demand; our assembled input+popover layer
  remains the differentiator, but the primitive should be reachable.
- **Imperative ref API**: `focus()`, `open()`, `close()` — small, for form
  libraries and tests.
- **`onMonthChange`** and a controlled `month` prop for analytics and linked
  calendars; `openTo` (`"days" | "months" | "years"`) so birth-date pickers
  can open on the year view.
- **`today` prop**: injectable "today" for deterministic tests and
  screenshots (Cally has this; it also gives consumers with fixed-timezone
  business rules a correct today marker, resolving the limitation recorded
  at `localToday` in the source — which itself requires a decision first;
  see D16). If fuller timezone support ever lands, adopt MUI's value
  vocabulary verbatim: `'default' | 'system' | 'UTC' | <IANA name>`.
- **Form integration**: an optional hidden native input carrying `name` and
  the ISO date string for `FormData` and server-post workflows, with
  `autocomplete="bday"` support for birth-date use.
- **Typed-input failure reporting**: an optional `onValidationError(reason)`
  callback with a typed reason union following GOV.UK's error taxonomy
  (missing, impossible date, not selectable). The component reports; the
  consumer renders. This preserves the API contract that the component never
  decides validity — `hasError` stays visual-only and `commitTyped` still
  consults only `shouldDisableDate`.

---

## Track 3 — Calendar features

- **Richer disabled-day input.** Adopt react-day-picker's `Matcher` union —
  `Date | Date[] | { before } | { after } | { from, to } | { dayOfWeek } |
  predicate | array of these` — as an optional **`disabledDates`** prop (the
  bare name `disabled` is taken: it disables the whole picker and fires
  `onDisabledOpenAttempt`, a parity behaviour) that **compiles into the
  existing predicate**. `shouldDisableDate` remains the single authority
  (parity contract); matchers are sugar feeding it, never a second
  mechanism. Naming and merge semantics are D12's to settle.
- **Day decoration**: `modifiers` + `modifiersClassNames` for marking days
  (booked, holiday, event), rendered through the same data-attribute contract
  so CSS can target custom states. Optional per-day title text for tooltips.
- **Range selection** — the highest-value single feature (see market gap 4).
  Single-input range with `mode="range"`, plus the two-input idiom
  (`selectsStart` / `selectsEnd` pattern) for check-in/check-out layouts.
  Include the details incumbents get right: minimum/maximum span, a flag
  refusing ranges that cross disabled days, and auto-swap of inverted ranges.
  Design decision required before work starts (see D13 below).
- **Multiple selection** (`mode="multiple"`) — cheap once range lands.
- **Multi-month display** (`numberOfMonths`), with paged navigation —
  scheduled with range selection, whose standard UX is two visible months.
- **Week numbers**, both ISO 8601 and locale week numbering (CLDR
  `minimalDays` differs between European and most other locales; Intl
  supplies this via `getWeekInfo`).
- **Fixed six-week grid** option so the popover height never jumps between
  months (Mantine's `consistentWeeks`), and `showOutsideDays`.
- **Month and year picker modes**: clamp the existing three-view core with
  `minLevel` / `maxLevel` instead of shipping separate components — Mantine's
  design, and the cleanest expression of what our month/year grids already do.
- **Presets / shortcuts**: `presets: { label, getValue }[]` with lazily
  evaluated values (never stale "today"), auto-disabled when the produced
  value fails validation, and MUI's `changeImportance` distinction between
  previewing and committing.
- **Week start override** (`weekStartsOn`) as a narrow escape hatch layered on
  the Intl-derived default — the reverse of the market default, where manual
  configuration is the only option.
- **Time selection is out of scope** for this component. A time picker is a
  different control with different semantics; bolting it on is where surveyed
  APIs grow their worst complexity. Revisit only as a separate component, and
  only after 1.0 (D15).

---

## Track 4 — Internationalization depth

Doubling down on the reason this package exists. Research findings that make
this concrete:

- **Localized digit rendering.** Accept the Unicode `-u-nu-` locale extension
  and/or a `numerals` prop. Initial default stays `latn` (today's behaviour);
  deriving the default from the locale's own
  `resolvedOptions().numberingSystem` — so an `ar-EG` user gets Arabic-Indic
  digits without configuration, which none of the surveyed libraries does —
  is the 1.0 consideration, flagged as a default change in release notes.
- **Digit input normalization, generalized.** The current implementation
  normalizes the two Arabic-Indic ranges. Locales defaulting to `beng`,
  `deva` and `mymr` digits exist as well. Replace the hardcoded ranges with a
  digit map generated from `Intl.NumberFormat` per numbering system — React
  Aria's technique, and the only approach that stays zero-maintenance.
- **[x] Calendar-system correctness for the echo — a real defect found during
  this survey.** `Intl.DateTimeFormat("ar-SA")` resolves to the
  islamic-umalqura calendar and `th-TH` to the Buddhist era, so the long-form
  echo can today disagree with the Gregorian grid (a Gregorian selection
  echoes as a Hijri date). Near-term fix: pin `calendar: "gregory"` (and the
  grid's numbering assumptions) in the formatters so echo and grid always
  agree — the substance of D11. **Fixed
  2026-07-26:** D11 decided and applied; regression tests in
  `tests/calendar-gregory.test.tsx`. Longer term: opt-in display calendars
  via `-u-ca-` (always pinning a variant — bare `islamic` diverges from
  `islamic-umalqura` in most months), while the value stays a
  Gregorian-interpreted `Date`. Full non-Gregorian grids are research-grade
  (no surveyed library derives them from Intl alone; competitors ship
  conversion tables) and stay out of scope until proven feasible.
- **Typed month names.** GOV.UK research found users typing "january" into
  date fields, and we hold Intl-provided month names for the active locale.
  Honest cost note: the current mask strips every non-digit on input, so
  this requires deliberately loosening a load-bearing, parity-protected
  behaviour (letters accepted in the month segment, or matched on
  paste/blur parse only). Not cheap; gated on the Phase 3 masking coverage
  existing first.
- **RTL hardening**: logical properties throughout the Phase 2 stylesheet,
  `:dir()`-based chevron flipping, and the `direction` prop from
  [`API.md`](API.md) (`"auto"` resolving from the locale). Arrow keys already
  follow visual direction; keep that under test.
- **Temporal readiness.** Temporal reached Stage 4 in March 2026 and ships in
  Firefox and Chrome; Safari was in preview at survey time. Plain `Date`
  stays our contract, with optional `Temporal.PlainDate` accept/emit adapters
  once support is broad (D14). API shapes chosen now should convert
  trivially.

---

## Track 5 — Accessibility completion

The converged model (APG dialog example, Duet, Cally agree) is the target;
gaps against it found in the current component are listed honestly:

- **[x] Keyboard map completion.** Present: arrows, Enter, Space, Escape,
  ArrowDown-into-grid. Missing versus the converged model: `PageUp` /
  `PageDown` (month), `Shift+PageUp` / `Shift+PageDown` (year), `Home` /
  `End` (week bounds). **Fixed 2026-07-26:** full map implemented with
  month-end clamping; regression in `tests/keyboard-map.test.tsx`.
- **[x] Voice-control-safe day names — defect found during this survey.** Day
  buttons are labelled with the full formatted date beginning with the
  weekday, which breaks "click 18" style voice commands. Rule from the audit
  literature: the accessible name of a day must begin with the day number.
  An accessibility correction, so the changed announcement ships as a
  default (called out in release notes) rather than an opt-in. **Fixed
  2026-07-26:** day aria-label is now `{day} {weekday} {month} {year}` via
  Intl parts; regression in `tests/day-accessible-name.test.tsx`.
- **Announcements**: keep the polite month/year live region and add
  `aria-atomic="true"` (Cally's fix for fragment announcements); add the
  APG's one-time keyboard-help announcement when focus enters the grid; echo
  the committed value into the trigger's accessible name ("Change date,
  17 November 2026").
- **Roving-focus rules.** What is implemented — deliberately — is a roving
  tabindex TARGET chain (keyboard cursor, else selected value, else today if
  enabled, else first enabled day), with DOM focus entering the grid only on
  keyboard navigation; opening never steals focus from the text input,
  because the input must stay typeable (parity contract). Keep exactly this
  under regression test. The APG's focus-the-selected-day-on-open rule
  applies only to trigger-button opens, and only if a dedicated trigger flow
  is ever added; it must never apply to input-click opens. Focus already
  returns to the input on close — keep under test.
- **`role="grid"` semantics** with `aria-selected` (the APG/Duet side of the
  schism; Cally's `aria-pressed` divergence is documented but grid matches
  screen-reader table navigation and audit checklists). Migrating from the
  current `aria-current="date"` marking is an accessibility correction,
  handled like the day-name fix above.
- **Forced-colors and reduced-motion** (Track 1) and **target sizes** (44px
  touch default, 24px floor).
- **Screen-reader matrix** as a release gate: VoiceOver (macOS/iOS), NVDA,
  JAWS, TalkBack — the bar Duet set and then abandoned; plus an automated axe
  pass in CI (already planned in [`TESTING.md`](TESTING.md)).
- **Typed-input error guidance**, ported from GOV.UK's research and delivered
  through the `onValidationError` callback defined in Track 2 — the
  component classifies and reports, the consumer renders, so the
  never-decides-validity contract holds. Never auto-advance focus between
  typed segments.

---

## Sequencing

Versions after the 0.1.0 first publish (PLAN.md Phase 5). Each minor ships
with tests to the TESTING.md bar; a red suite blocks any release.

Already shipped in 0.1.0, ahead of this table: the token layer, CSS-only
light/dark, basic forced-colors and reduced-motion rules, `classNames` and
`icons` (Phase 2 / D3); the completed keyboard map, voice-control-safe day
names and the Gregorian echo pinning (D11). The rows below carry only what
remains.

| Version | Contents | Depends on |
|---|---|---|
| 0.2 | Track 1 remainder: published data-part anatomy, named themes + `themeName`, `styles` map, `labels`, opt-outs for existing built-ins, oklch palette pass, documented Tailwind bridge | D10 |
| 0.3 | Track 5 remainder: aria-atomic month heading, grid-entry keyboard-help announcement, trigger accessible-name echo, `role="grid"` migration; digit-map generalization; `onValidationError` | 0.2 |
| 0.4 | `disabledDates` matchers, modifiers, presets, week numbers, fixed weeks, month/year modes + `openTo`, standalone Calendar, controlled/uncontrolled state, slots + `renderDay`/`getDayProps`, footer utilities, `clearable`, ref API, `onMonthChange`/`month`, native input surface, placement + Popover-API/portal escape, `today` prop | D12, D16 |
| 0.5 | Range and multiple selection; `numberOfMonths` | D13 |
| 0.6 | Display format contract; localized digit rendering; `-u-ca-` display calendars; typed month names; Temporal adapters | D11, D14, D17 |
| 1.0 | Stability declaration: API freeze, semver guarantee, documented deprecation policy; decide locale-derived numeral default | everything above green |
| Backlog, unscheduled | Opt-in mobile dialog / bottom-sheet presentation for coarse pointers (until then, typed-input-first is the mobile story); `weekStartsOn` override; per-day tooltips | — |

Items inside a minor can be re-ordered freely; the version boundaries mark
dependency and decision gates, not promises of dates.

---

## Decisions this roadmap creates

To be registered in [`DECISIONS.md`](DECISIONS.md) (D10 onward) when the
relevant work starts, so the register stays the single source of truth. Listed
here so the shape of each is not lost:

- **D10 — Theme token set and naming.** The `--rldp-*` vocabulary, the
  semantic-pair convention, and which themes ship. Recommendation is written
  in Track 1.
- **D11 — Echo calendar policy.** Pin `gregory` for formatter consistency
  versus honouring locale-default calendars. Recommendation: pin, then make
  display calendars opt-in. Decided and shipped 2026-07-26 (see
  DECISIONS.md); only the opt-in display-calendar half remains, in 0.6.
- **D12 — Matcher API adoption.** Whether the `Matcher` union lands, under
  what prop name (`disabledDates` recommended; `disabled` is taken by the
  whole-picker prop), and how it compiles into `shouldDisableDate` without
  creating a second authority.
- **D13 — Range architecture.** Single component with `mode` versus a
  separate range component; single-input versus two-input; value shape.
- **D14 — Temporal adoption timing.** Criteria: Safari stable ship plus one
  year, or a major consumer requesting it.
- **D15 — Time selection.** Default recommendation: permanently out of scope
  for this component; a sibling component at most.
- **D16 — Injectable today / timezone.** The `today` prop's shape, default
  and interaction with `shouldDisableDate` — required by the source comment
  at `localToday` before any such API is added.
- **D17 — Display format contract.** Locale-derived default versus fixed,
  the `format` override shape, and the parse/format escape-hatch pair; must
  define how the mask re-derives per format.

---

## Non-goals

Recorded so future contributors do not relitigate them silently:

- No date-library adapters, ever. The adapter architecture is MUI's biggest
  liability and the negation of this package's premise.
- No bundled locale files, ever, for any locale.
- No runtime CSS-in-JS.
- No UMD build unless a real consumer asks.
- No JavaScript system-theme detection shipped in the package; CSS handles
  the default and apps own the toggle.
- No confirm-step default. `needConfirm`-style behaviour may exist as an
  opt-in, never as the default.
- No breaking of the parity contract for any feature, however attractive.
