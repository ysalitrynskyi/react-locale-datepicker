# Open decisions

Each entry states the decision, the options, a recommendation, and who decides.
**Blocking** decisions gate work that depends on them — check here before
building something that assumes an answer.

When a decision is made: change **Status** to `DECIDED <date> — <outcome>`, keep
the reasoning, and do not delete the alternatives. A future reader needs to know
what was rejected and why.

---

## D1 — Ownership and license — **BLOCKING, operator only**

**Status:** DECIDED 2026-07-26 — MIT, copyright **Yevhen Salitrynskyi**.

The component was written for a private commercial product. Publishing it as
open source asserts a right to do so. That assertion belongs to whoever owns the
code, and no agent can determine ownership from a repository.

Questions the operator answered by directing the first publish (2026-07-26):

1. Who owns the copyright — **the operator personally** (Yevhen Salitrynskyi).
2. Company/client grant — not required for this personal publication path.
3. Copyleft derivation — no evidence; component written from scratch to replace
   a third-party picker.

**Recommendation (and outcome): MIT.** Least restrictive, familiar for UI
components, maximizes adoption. Text applied at `/LICENSE` with
`Copyright (c) 2026 Yevhen Salitrynskyi`. `package.json` carries
`"license": "MIT"` and matching `author`. The staged draft at
`docs/LICENSE-MIT.txt` is retained for history only.

---

## D2 — Package name — **effectively decided, reversible until first publish**

**Status:** DECIDED 2026-07-26 — `react-locale-datepicker`, locked by the
0.1.0 publish. Renaming now means a new package and a deprecation notice, so
treat the name as permanent.

Free on npm and GitHub at the time of writing. Chosen because it names all three
relevant facts (React, locale-driven, date picker) and is searchable.

Alternatives considered and why they lost:

| Name | Why not |
|---|---|
| `react-intl-datepicker` | Reads as a companion to `react-intl` (FormatJS), which it is not. Brand confusion with a much larger package. |
| `intl-date-picker` | Implies framework independence; this is React-only. |
| `omnidate` | Catchy, but tells a searcher nothing. |
| `@scope/date-picker` | A scope tied to the product would leak the commercial origin into every install line. |

**Renaming is cheap now and expensive after the first npm publish.** If the name
is going to change, change it before Phase 5.

---

## D3 — Styling strategy — **BLOCKING for Phase 2**

**Status:** DECIDED 2026-07-26 — Option D, the hybrid: self-contained scoped
CSS imported from `react-locale-datepicker/styles.css`, themed through
`--rldp-*` custom properties, with `className` / `classNames` overrides.
Light and dark ship together (CSS-only, `color-scheme` + `light-dark()`,
honouring `.dark` / `[data-theme="dark"]` ancestors). Resolution: the
recommendation below was presented to the operator twice; the operator then
directed completion of all remaining work, which requires this decision. If
the operator objects to the specifics, the stylesheet is the only artifact
affected and is cheap to revise.

The source component styles itself with Tailwind utility classes. A published
component cannot assume the consumer has Tailwind.

| Option | Upside | Downside |
|---|---|---|
| **A. Ship compiled CSS** — one stylesheet the consumer imports | Works everywhere, zero setup | Consumers must import CSS; harder to restyle; a build step to maintain |
| **B. Headless** — no styles, expose `classNames` / render props | Maximum flexibility, no CSS shipped | Nobody gets a working picker out of the box; a demo is mandatory; much larger API |
| **C. Tailwind as a peer expectation** — ship classes, document the requirement | No build step, smallest diff from the source | Silently unstyled for non-Tailwind consumers. A bad first-run experience, which is the most common reason a component gets abandoned |
| **D. Hybrid** — self-contained CSS by default, `classNames` overrides for everything | Good default, still restylable | Most implementation work of the four |

**Recommendation: D**, with the CSS written as plain scoped styles using CSS
custom properties for colour, radius and spacing. That gives a picker that looks
correct on first install, lets Tailwind users override with `classNames`, and
avoids forcing a framework choice on anyone. Budget the extra work in Phase 2 —
it is roughly a day, and it is the difference between a component people adopt
and one they bounce off.

Reject C. It is the least work and the worst outcome.

---

## D4 — Icon dependency — **recommended, low risk**

**Status:** DECIDED 2026-07-26 — inline SVGs, no icon dependency.

The source imports four icons from `lucide-react`. A component library should not
drag in an icon set for four glyphs.

**Recommendation: inline the four SVGs** and drop the dependency, so the package
has zero runtime dependencies beyond a `react` peer. Optionally expose an
`icons` prop so consumers can substitute their own set — cheap to add and it
removes any objection about visual consistency.

**Outcome:** the recommendation as written, applied during the Phase 1 port.
The four glyphs (calendar, chevron left/right/down) are hand-drawn 24px
stroke paths in the component file, so the package keeps zero runtime
dependencies. Decided at agent level because this entry is non-blocking and
the port could not proceed on any other option: adding `lucide-react` would
have violated the no-new-dependency rule. The optional `icons` substitution
prop is deferred until D3 settles the styling API shape, alongside
`classNames`.

---

## D5 — Supported React versions

**Status:** DECIDED 2026-07-26 — the recommendation as written. 0.1.0 shipped
with `peerDependencies: { "react": ">=18", "react-dom": ">=18" }` and the
suite runs on React 19; nothing tests or promises 17. Since 0.6.0 the
component also uses `React.useId`, which React 17 does not have.

**Recommendation:** `peerDependencies: { "react": ">=18" }`. React 18 introduced
the behaviour around `useId` and concurrent rendering the component should rely
on. Supporting 17 means testing 17, and there is no known consumer asking for it.
Revisit only if someone opens an issue.

---

## D6 — Bundling and module format

**Status:** DECIDED 2026-07-26 — `tsup` library mode, ESM + CJS + `.d.ts`,
`"sideEffects": false`. No UMD.

**Recommendation (and outcome):** `tsup` in library mode, emitting ESM plus CJS
plus `.d.ts`, with `"sideEffects": false` so consumers tree-shake cleanly.
Include the CSS build from D3 as a separate export path (`./styles.css`) once
D3 lands — the styles export is intentionally absent until then. Do not ship a
UMD bundle unless someone asks.

Decided at agent level during Phase 4 packaging prep: non-blocking, matches
the recommendation already in this file, and is required to produce a
verifiable tarball without waiting on D3.

**Dev-only addition, 2026-10-01: `@types/node`.** The tests and the e2e
config use Node built-ins and are type-checked by `tsc -p
tsconfig.test.json`. Without the package that check passed only on a machine
with a stray copy in a parent directory (TypeScript searches upward for
`@types`) and failed on CI. It is a development dependency and never reaches
the published package. Both tsconfigs now list their `types` explicitly, so
nothing above the repository can make a local run differ from CI again.

---

## D7 — Does the source product consume the package?

**Status:** SETTLED in practice, 2026-08 — the source product depends on the
package at an **exact** version pin (never a range), as this entry recommended
for whenever adoption happened.
The conditions below were met first: a version history and a suite that
covers the parity contract end to end. Every release since is therefore also
a release the source product will take on its next pin bump, which is why
behaviour changes are called out per item in the changelog.

Once published, the source product could import the package instead of keeping
its own copy.

**Recommendation: not initially.** The component sits on a checkout's critical
path, and the governing rule in that product is that buying must never break.
Adding an external dependency to that path for tidiness is a poor trade. Keep the
in-product copy, sync deliberately, and accept the divergence risk — it is the
cheaper kind of cost.

Revisit only when the package has a real version history and a test suite that
covers the parity contract end to end. If it is ever adopted there, pin an exact
version, never a range.

---

## D8 — Maintenance posture

**Status:** DECIDED 2026-07-26 — the middle option, stated in the README:
maintained as time allows, issues and PRs welcome, no response-time promise.
Applied at agent level per the recommendation below during the post-release
documentation sweep; the operator can harden or soften the wording at any
time — it is one README paragraph.

Publishing invites issues about browsers and locales the maintainer does not use.
Decide, and state in the README, which of these is true:

- actively maintained, issues triaged;
- maintained as time allows, PRs welcome, no response-time promise;
- published as-is, no support, fork encouraged.

**Recommendation: the middle one.** It is honest, it is what will actually
happen, and setting the expectation up front prevents the resentment that kills
small projects.

---

## D9 — Public demo

**Status:** DECIDED 2026-07-26 — the recommendation as written: a minimal
Vite demo in `examples/`, with a GitHub Pages workflow prepared in the
repository. Decided at agent level while building Phase 6; non-blocking, and
the recommendation was already written here.

A date picker is close to unsellable without something to click. A single static
page with a locale switcher (including one RTL locale) and a disabled-days
example would carry most of the value.

**Recommendation:** a minimal Vite demo in `examples/`, deployed to GitHub Pages
from CI. Defer to Phase 6 — after the component works, before announcing it
anywhere.

### How it consumes the package

The demo installs the package as `file:..` and imports
`react-locale-datepicker` by name. It deliberately does **not** deep-import
`../src`, which would have been simpler and would have made the demo prove
nothing: the point is to exercise the same entry points, `exports` map and
built `dist` that a real consumer resolves. A demo that imports the source
cannot catch a broken `exports` map, a missing `"use client"` banner or a
stylesheet that fails to resolve — which are exactly the failures that
reach users and never reach the test suite.

`resolve.dedupe` for `react` and `react-dom` is load-bearing rather than
tidy-up: a `file:` dependency is symlinked, so the linked package resolves
React from the repository root while the app resolves its own copy, and two
Reacts in one tree is an immediate hooks crash.

### What is deliberately NOT done here

Enabling GitHub Pages and running the first deployment are repository
**settings** actions, which `AGENTS.md` reserves to the operator. The
workflow is therefore written and committed but triggered by
`workflow_dispatch` only. It cannot fire, and cannot fail noisily, until the
operator enables Pages and adds the push trigger — a one-line change
documented in the workflow itself.

---

## D11 — Echo calendar policy

**Status:** DECIDED 2026-07-26 — pin `calendar: "gregory"` on every
`Intl.DateTimeFormat` the component constructs.

**Problem:** `Intl.DateTimeFormat("ar-SA")` resolves to the islamic-umalqura
calendar and `th-TH` to the Buddhist era. The days grid is always Gregorian
(plain `Date` year/month/day), so the long-form echo under the field could
disagree with the day the user clicked — a Gregorian 18 July 2026 selection
echoed as a Hijri date in ar-SA, or as Buddhist-era year 2569 in th-TH.

**Options:**

| Option | Upside | Downside |
|---|---|---|
| **A. Pin `gregory`** on formatters | Echo, labels and grid always agree; zero deps | Locales whose default calendar is non-Gregorian no longer see their default in the echo |
| **B. Honour locale-default calendars** | Culturally default display | Echo disagrees with the Gregorian grid and value contract |
| **C. Full non-Gregorian grids** | Complete calendar-system support | Research-grade; competitors ship conversion tables; out of scope for zero-deps |

**Recommendation (and outcome): A.** Pin `gregory` so echo and grid always
agree. Longer term, opt-in display calendars via `-u-ca-` (always pinning a
specific variant — bare `islamic` diverges from `islamic-umalqura`) while the
value stays a Gregorian-interpreted `Date`. Full non-Gregorian grids stay out
of scope until proven feasible without bundled tables (see `docs/ROADMAP.md`
Track 4).

Decided at agent level: non-blocking, recommendation already written in the
roadmap, and the defect is a real behaviour correction with a regression test.

---

## D10 — Theme token set, anatomy and token resolution

**Status:** DECIDED 2026-07-26 — the recommendation written in `ROADMAP.md`
Track 1, plus the token-resolution architecture below, which that
recommendation implies but does not spell out.

Opened because ROADMAP 0.2 (published anatomy, named themes, `styles`,
`labels`, opt-outs, oklch palette) cannot be built without settling it.
Decided at agent level: the roadmap already carries the recommendation, the
operator directed the 0.2 work, and every part of it is reversible by editing
one stylesheet and one exported constant.

### The vocabulary

`--rldp-*`, defined on the component root, never `:root`, so two differently
themed pickers coexist on one page. Semantic pairs follow the shadcn
vocabulary consumers already know (`--rldp-background` /
`--rldp-foreground`, `--rldp-accent` / `--rldp-accent-foreground`), plus
component knobs (`--rldp-cell-size`, `--rldp-radius`, `--rldp-z-index`).
The 0.1.0 token names are kept verbatim; 0.2.0 only adds.

### The anatomy

One canonical list, exported as `ANATOMY`, drives three things that used to
drift apart: the `data-part` attribute stamped on every rendered element, the
`classNames` / `styles` keys, and `docs/ANATOMY.md`. `data-part` values are
kebab-case (they are CSS selectors); slot keys are camelCase (they are
JavaScript identifiers). State stays on data attributes
(`data-selected`, `data-disabled`, `data-today`, `data-error`, `data-open`),
so a consumer who never imports the stylesheet still has a complete styling
contract. Existing slots are never removed or renamed — `Slot` grew, it did
not change.

### Token resolution — the part that needed a real decision

**A bug was found while deciding this.** `README.md` documents overriding
tokens "on any ancestor". That does not work in 0.1.0 and never did: the
stylesheet declares every token on `.rldp-root` itself, and an element's own
declaration always beats an inherited value, whatever cascade layer it sits
in. Verified in Chromium before writing this entry. The same mechanism is
what would make nested themes resolve by stylesheet order instead of by
proximity.

| Option | Upside | Downside |
|---|---|---|
| **A. Declare defaults on `.rldp-root`, themes as descendant selectors** | Smallest diff | Ancestor overrides silently ignored; nested themes resolve by source order, not by nearest ancestor — both wrong |
| **B. Leave public tokens undeclared; read them as `var(--rldp-x, var(--rldp-d-x))`; themes declare public tokens on whichever element carries the attribute** | Ancestor overrides and nested themes both work by plain custom-property inheritance, which already resolves to the nearest ancestor | Every usage site carries a two-level `var()`; one private `--rldp-d-*` default per public token |
| **C. `@scope` with scoping proximity** | Expresses "nearest theme wins" directly | Young support, and it solves only nesting, not the ancestor-override bug |

**Recommendation (and outcome): B.** It fixes a documented-but-broken
capability and gets nestable themes for free, because "nearest ancestor wins"
is exactly what custom-property inheritance already does. The private
`--rldp-d-*` layer is an implementation detail and is not part of the public
contract; consumers keep writing `--rldp-accent`.

The `default` theme is expressed as `--rldp-<token>: initial` for each token
rather than by restating the values. `initial` on a custom property yields
the guaranteed-invalid value, so the usage-site fallback takes over — which
is precisely "no overrides", stated once per token and impossible to drift
from the real defaults.

### Which themes ship

`default`, `minimal` (borderless, flat, typography-led), `soft` (larger
radii, filled surfaces), `high-contrast` (AAA contrast targets, thicker focus
indicators). Selectable from CSS via `[data-rldp-theme="<name>"]` on any
ancestor or on the root, and from React via `themeName`, which stamps the
same attribute. The attribute path stays for CSS-only consumers; the prop
satisfies configuration-through-props users. No `themeName` means no
attribute, so an ancestor theme still applies; `themeName="default"` is the
explicit opt-out from one.

### Palette format

`oklch()`, converted from the 0.1.0 hex values so the default look does not
change — every channel round-trips to within one 8-bit step, verified by
pixel-diffing the README captures before and after. oklch is the format in
which hover and dark shades derive predictably, which is what the named
themes need.

---

## D16 — Injectable today and business timezone

**Status:** DECIDED 2026-07-26 — `today?: Date` and `timeZone?: string`
props plus an exported `todayInTimeZone(timeZone)` helper. Decided at agent
level: the roadmap entry already defined the shape, and the operator asked
for timezone support directly after testing 0.2.0 ("when they sell something
in some country and people buy from the other side of the planet").

What "today" means was the one timezone-sensitive thing left in the
component: the today ring, the default view month, the default keyboard
target and the default year range all derived from the visitor's clock. A
shop whose availability rules run on the seller's calendar day (the case the
source product hardcoded its business timezone for) needs "today" derived in
that zone — the two can differ by a day in either direction.

Outcome:

- `timeZone` accepts an IANA name; `"default"` and `"system"` (MUI's
  vocabulary, adopted verbatim as recommended by the roadmap survey) both
  mean the visitor's own zone. Invalid names fall back to the visitor's
  zone rather than throwing — the same never-throw posture as
  `resolveLocale`.
- `today` (a plain local-midnight `Date`) wins over `timeZone`. It exists
  for deterministic tests and screenshots, and for consumers whose "today"
  is not a wall-clock fact at all.
- `todayInTimeZone` is exported so consumers can build their
  `shouldDisableDate` on the same business day the marker uses.

Rejected alternative: converting the VALUE through the timezone. The
timezone contract in `docs/API.md` is the package's most load-bearing
promise — values are local-midnight `Date`s, never shifted — and a
convert-the-value mode would reintroduce exactly the day-shift bug class the
contract exists to prevent. Only the derivation of "today" is affected.

---

## D17 — Popover containment / portal escape

**Status:** DECIDED 2026-08-11 — opt-in `portal?: boolean | HTMLElement`.
Default remains the in-tree `position: absolute` popover (0.3.x behaviour).

**Prompt:** a live multilingual checkout audited the package for adoption.
Its form card is `overflow: hidden` (rounded shadow shell). An absolute
popover inside that shell is clipped — observed in the e2e harness, not
reasoned about: dialog height ≈ 282px, only ≈ 90px visible through a 72px
card (clip ratio ~0.32). The same form is also framed cross-origin by other
sites, so any escape must work inside an iframe's own document.

**Options:**

| Option | Upside | Downside |
|---|---|---|
| **A. Always portal to `document.body`** | Never clips | Changes stacking for every existing consumer; breaks layouts that relied on the popover living inside a transformed/stacked parent |
| **B. Opt-in `portal` prop** | Additive; default unchanged | Consumers with clipped cards must discover and set it |
| **C. `position: fixed` without portaling** | Smaller code | Still clipped by `overflow: hidden` ancestors — does not solve the bug |
| **D. Document only, no escape** | Zero code | Blocks the checkout adoption |

**Outcome: B.** `portal={true}` → `createPortal` into `document.body` with
`position: fixed` coordinates measured from the field; `portal={HTMLElement}`
→ that host (modal roots, app shells). Outside-click treats the portaled node
as inside the component; Escape and the keyboard model are unchanged. Theme
tokens (`--rldp-*`) and `color-scheme` are copied from the root onto the
portaled node so ancestor-scoped theming still applies. Semver: additive
optional prop → minor (0.4.0). Not a major: default layout behaviour is
identical to 0.3.x.

Cross-origin iframe note: a portal cannot leave the iframe (browser security).
It targets the iframe's `document.body`, which is exactly what an embedded
checkout needs — the clip ancestor is inside the same document.

Rejected C after the harness observation: fixed-without-portal still paints
as a descendant and is clipped by the overflow card.

---

## D18 — When the on-screen keyboard may appear

**Status:** DECIDED 2026-08-12 — `manualEntryOnTouch?: "second-tap" |
"immediate"`, defaulting to `"second-tap"`. Shipped 0.5.0.

**Prompt:** the same live checkout, now in production, reported from a phone:
every tap on the date field raised the on-screen keyboard, which costs roughly
half a phone viewport; the calendar then jumped as the viewport shrank under
it; and picking a day from the grid raised the keyboard too — on the tap that
exists precisely so nobody has to type. The hand-rolled picker this package was
extracted from did none of this: its `close()` defaulted to *not* refocusing,
so a day selection never brought the keyboard back. The regression arrived with
the extraction.

**Options:**

| Option | Upside | Downside |
|---|---|---|
| **A. Read-only field on touch** | Zero accidental keyboards | Removes manual entry on phones entirely. A buyer picking a date months out has to page through the calendar, and most checkout traffic is mobile |
| **B. Second tap on the text = intent to type** | Keeps typing; no new UI; nothing to translate | The affordance is invisible until discovered — mitigated by the first tap doing the useful thing anyway |
| **C. Long-press to type** | Fewer accidental keyboards than B | Undiscoverable, and collides with the iOS text-selection menu |
| **D. A "type it" control inside the popover** | Explicit and discoverable | A new UI string in every consumer's locale set, and a control inside a popover consumers have already signed off on visually |

**Outcome: B.** First tap opens the grid with `inputMode="none"`; tapping the
text again while the calendar is open raises the keyboard. `"immediate"` is
kept as an escape hatch for consumers who want the old behaviour. Semver: a
behavioural default change with an opt-out → minor while 0.x.

Two implementation notes that cost a round each, recorded because both look
like details and are not:

**The attribute is rendered unconditionally, not behind a pointer check.** On a
device with a physical keyboard `inputMode` does nothing observable, so gating
it buys nothing and costs the thing that matters: identical server and client
markup. The first tap is the one that must not raise a keyboard, so anything
decided after mount is decided too late. A `useSyncExternalStore` version —
server snapshot `false`, live client snapshot, subscribed to `(pointer:
coarse)` — passed all 12 tests and then, on the real page, left the attribute
at `numeric` through the entire first tap, because nothing re-rendered the
component until the visitor interacted with it.

**Activation is read from the event, not from the device.** `(pointer: coarse)`
describes the *primary* pointer, so a touchscreen laptop on its trackpad and
the same laptop under a finger are indistinguishable to it — and those two want
opposite handling of the focus return. `PointerEvent.pointerType` is the
interaction itself — read from the `pointerdown` that started the click since
0.6.0, because Safari 18.2+ reports a finger's click as `"mouse"` (WebKit bug
282988); `detail === 0` identifies synthesized
clicks (assistive tech, Enter/Space on a button) first, since those are keyboard
users whatever hardware is attached. The media query survives only as a fallback
for synthetic events.

Two behaviours changed alongside and are deliberately **not** configurable,
because neither has a defensible other side: focus is no longer returned to the
input after a touch pick, and the popover's above/below side is frozen for the
lifetime of an open popover. The second one is what "the calendar goes up and
looks weird" was — a keyboard halves `window.innerHeight`, collapsing the space
below the field, and the side was being re-decided on every resize frame.

---

## D19 — Layout direction (`direction` prop)

**Status:** DECIDED 2026-10-01 — `direction?: "ltr" | "rtl" | "auto"`,
default *inherit*. In 0.6.0.

**Prompt:** `docs/API.md` had documented `direction` with default `"auto"`
("resolves from the locale") since 0.1.0, and the prop never existed (bug hunt
BH-007). Without it, an ancestor `dir` was the only way to get RTL, and a
portal dropped that ancestor (BH-013).

**Options:**

| Option | Upside | Downside |
|---|---|---|
| **A. Default `"auto"` (from locale), as the old doc said** | An Arabic picker is RTL anywhere | Flips the field and calendar of every existing consumer whose locale is RTL but whose page is not — a form laid out LTR suddenly has an RTL field in it |
| **B. Default inherit; `"auto"` opt-in** | No existing caller changes; the page owns its layout | A page that sets no `dir` but shows an Arabic picker must opt in |
| **C. Remove the prop from the docs** | No code | Leaves portaled RTL broken and no way to set direction per picker |

**Outcome: B.** Omitted means inherit the nearest ancestor's direction, read
from computed style (so an ancestor `dir="auto"` counts) with the nearest
`dir` attribute as the fallback where there is no layout engine (jsdom).
`"auto"` derives it from the locale through `Intl.Locale` text info, with a
list of right-to-left languages for engines without it. The resolved
direction is always stamped on the popover, so a portaled calendar keeps it,
and the chevron flip keys on that attribute. In RTL the popover opens from
the field's right edge.

---

## D20 — Numerals

**Status:** DECIDED 2026-10-01 — Latin digits everywhere unless the locale
tag carries a `-u-nu-` extension. In 0.6.0.

**Prompt:** bug hunt BH-054. The typed field, day numerals and year pill were
Latin (`getDate()`, `getFullYear()`), while every `Intl` formatter followed
the locale's default numbering system, so under `ar` or `fa` the echo and the
month title announced `٢٠٢٦` next to a pill that said `2026`.

**Options:**

| Option | Upside | Downside |
|---|---|---|
| **A. Pin Latin on every formatter** | One system, matching the typed field; the ROADMAP already said the default stays Latin | Changes the echo's digits for Arabic and Persian locales that used to get Arabic-Indic ones |
| **B. Render day numerals and years in the locale's system** | Native digits by default | The typed field is ASCII by contract, so the widget would still mix two systems |
| **C. Leave it** | No change | Two numbering systems in one widget, read aloud differently |

**Outcome: A, with an opt-in.** Formatters pin `numberingSystem: "latn"`; a
locale tag that names a system explicitly (`"ar-u-nu-arab"`) switches the
formatters, the day numerals and the year pill and list to it, and only the
typed field stays ASCII. Deriving the default from the locale remains the
roadmap's 1.0 consideration.

---

## D21 — Focus and keyboard model: one widget, combobox-style

**Status:** DECIDED 2026-10-01. In 0.6.0.

**Prompt:** the bug hunt found the field and its calendar acting as two
unrelated things: the input's own blur committed a half-typed date and fired
the parent's validation when focus merely moved into the calendar (BH-014);
the calendar stayed open after keyboard focus left (BH-047); Tab from the field
walked into an in-tree calendar but skipped a portaled one, leaving it open
over the next field (BH-051); view switches dropped focus on `<body>` (BH-050,
BH-086).

**Outcome:** the field and the calendar — wherever a portal put it — are one
widget, with the keyboard model of a combobox and its popup (APG):

- ArrowDown opens the calendar and, pressed again, moves focus into the open
  view; Escape closes it and returns focus to the field.
- Tab and Shift+Tab from the field close the calendar and move on, as in any
  form. Inside the calendar Tab moves among its controls; a portaled
  calendar is routed back into field order at both ends.
- The draft is committed, the calendar closed and `onBlur` fired once, when
  focus leaves the widget — not when it moves between the field and the
  calendar. A close that unmounts the focused control counts as leaving
  too, because an unmounted control fires no blur: a press outside, or a
  finger pick, while focus is inside the calendar reports it directly.
  Leaving is reported once, whatever blur events follow it, until focus
  comes back.
- The calendar stays non-modal: no `aria-modal`, no focus trap, because the
  field remains operable while it is open.
- A view switch first parks focus on a control that survives it, then moves
  it into the new view. A month change that unmounts the focused day (a
  shorter month dropping a row) is not treated as leaving: the blur waits a
  microtask, sees the control is gone, and focus is re-placed on the new
  month's day after render.

**Rejected:** a modal dialog with a focus trap (APG's date picker dialog). It
fits a picker opened from a button, not one whose text field must stay
typeable while the calendar is shown, which is this component's premise.

---

## D12–D15, D22 — Roadmap decisions (not yet opened)

See `docs/ROADMAP.md` § "Decisions this roadmap creates". Opened only when the
relevant work starts so this register stays the single source of truth. The
display format contract was planned there as D17; the portal escape took that
number here first, so it is D22.
