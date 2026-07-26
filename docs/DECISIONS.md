# Open decisions

Each entry states the decision, the options, a recommendation, and who decides.
**Blocking** decisions gate work that depends on them — check here before
building something that assumes an answer.

When a decision is made: change **Status** to `DECIDED <date> — <outcome>`, keep
the reasoning, and do not delete the alternatives. A future reader needs to know
what was rejected and why.

---

## D1 — Ownership and license — **BLOCKING, operator only**

**Status:** OPEN. Nothing may be published to npm, and no `/LICENSE` file may be
added, until this closes.

The component was written for a private commercial product. Publishing it as
open source asserts a right to do so. That assertion belongs to whoever owns the
code, and no agent can determine ownership from a repository.

Questions the operator must answer:

1. Who owns the copyright — the operator personally, a company, or a client?
2. If a company or client is involved, has whoever can grant it agreed?
3. Was any part of it derived from a copyleft source? (No evidence of this; the
   component was written from scratch to replace a third-party picker. Worth
   confirming rather than assuming.)

**Recommendation: MIT**, once ownership is confirmed. It is the least
restrictive, the most familiar for a UI component, and it maximizes adoption,
which is the point of publishing. The text is staged at `docs/LICENSE-MIT.txt`;
moving it to `/LICENSE` is the act that closes this decision.

Until then the absence of a license file means all rights reserved, which is the
correct safe default for a public repository.

**Also decide the copyright line:** a personal name, or a company name. This
appears in the license and in `package.json` and is awkward to change later.

---

## D2 — Package name — **effectively decided, reversible until first publish**

**Status:** PROVISIONAL — `react-locale-datepicker`.

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

**Status:** OPEN.

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

**Status:** OPEN.

The source imports four icons from `lucide-react`. A component library should not
drag in an icon set for four glyphs.

**Recommendation: inline the four SVGs** and drop the dependency, so the package
has zero runtime dependencies beyond a `react` peer. Optionally expose an
`icons` prop so consumers can substitute their own set — cheap to add and it
removes any objection about visual consistency.

---

## D5 — Supported React versions

**Status:** OPEN.

**Recommendation:** `peerDependencies: { "react": ">=18" }`. React 18 introduced
the behaviour around `useId` and concurrent rendering the component should rely
on. Supporting 17 means testing 17, and there is no known consumer asking for it.
Revisit only if someone opens an issue.

---

## D6 — Bundling and module format

**Status:** OPEN.

**Recommendation:** `tsup` in library mode, emitting ESM plus CJS plus `.d.ts`,
with `"sideEffects": false` so consumers tree-shake cleanly. Include the CSS
build from D3 as a separate export path (`./styles.css`). Do not ship a UMD
bundle unless someone asks.

---

## D7 — Does the source product consume the package?

**Status:** OPEN. Consider this deferred rather than undecided.

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

**Status:** OPEN.

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

**Status:** OPEN.

A date picker is close to unsellable without something to click. A single static
page with a locale switcher (including one RTL locale) and a disabled-days
example would carry most of the value.

**Recommendation:** a minimal Vite demo in `examples/`, deployed to GitHub Pages
from CI. Defer to Phase 6 — after the component works, before announcing it
anywhere.
