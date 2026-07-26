# Implementation plan

Phases are ordered by dependency. Do not start a phase whose blocking decision
in [`DECISIONS.md`](DECISIONS.md) is still open.

Mark progress by editing the **Status** line of each phase. Keep it honest — a
half-done phase marked done is worse than no marker.

---

## Phase 0 — Groundwork

**Status:** DONE (repository created, documentation written).

- [x] Public repository, description, topics.
- [x] Planning, decision, API, extraction, testing and release docs.
- [x] `AGENTS.md`, contribution and governance files.
- [x] CI skeleton, issue and PR templates, `.gitignore`, editor config.
- [ ] **Operator: resolve D1 (ownership and license).** Everything downstream of
      Phase 4 is blocked on it, and it is worth answering before effort is sunk.

---

## Phase 1 — Port the component

**Status:** DONE 2026-07-26. Ported with no intended behaviour change beyond
the strips the extraction guide mandates (naming, business-timezone "today",
icon dependency — see the port commit message for the full list and the
ticked parity checklist). `tsc --noEmit` clean under strict mode; SSR-rendered
in a scratch harness across ten locales including `ua`, an RTL pair and two
malformed tags. Interactive behaviours (keyboard, focus, popup positioning,
RTL layout, 320px) are preserved verbatim in code but runtime-verified only in
Phase 3 — the parity contract is not considered proven until that suite runs.

Goal: the component compiles and renders in this repository, behaviour
unchanged, still styled with the utility classes it arrived with. Do not
restructure and re-style in the same step — a port and a redesign in one commit
is unreviewable.

1. Read `docs/EXTRACTION.md` in full first, especially § Parity contract.
2. Copy the component in. Keep every comment; they encode why each behaviour
   exists.
3. Strip product-specific naming. The generic component has no notion of travel,
   insurance, entering or departure — those become `value`, `minDate`,
   `maxDate`, `shouldDisableDate`.
4. Keep the exported locale-normalization helper public. It is genuinely useful
   to consumers and the source product already imports it separately.
5. `tsc --noEmit` clean under strict mode.
6. Commit as a port with no behaviour change, and say so in the message.

**Done when:** it type-checks and renders in a scratch harness, and every line of
the parity contract has been read and consciously preserved.

---

## Phase 2 — Styling

**Status:** BLOCKED on D3.

Once D3 is decided (recommendation: self-contained CSS with `classNames`
overrides):

1. Replace utility classes with the chosen approach.
2. Expose colour, radius, spacing and font through CSS custom properties.
3. Verify light and dark, and confirm no style leaks out of the component's root.
4. Confirm RTL still lays out correctly — this is where a restyle usually breaks
   it.

**Done when:** the component looks correct in a project with no CSS framework at
all.

---

## Phase 3 — Tests

**Status:** DONE 2026-07-26. Vitest + Testing Library unit/interaction suite
(39 tests) covers every line of [`TESTING.md`](TESTING.md); Playwright matrix
runs Chromium/Firefox/WebKit at 320/768/1280 (93 passed, 6 viewport-skipped).
CI runs typecheck, lint, unit tests under `TZ=UTC`, `America/Los_Angeles` and
`Asia/Tokyo`, and the Playwright matrix on every push/PR. Each parity-contract
test names the bug it guards in its failure message.

This is the largest single cost in the project and the most likely to be
underestimated. The production matrix that validated the original was run
ad-hoc and was never committed, so **there is no test suite to inherit.**

Follow [`TESTING.md`](TESTING.md). Minimum before any publish:

- [x] unit tests for date maths, masking, digit normalization and locale resolution;
- [x] interaction tests for one-tap commit, keyboard navigation, disabled days and
      the blur-commit ordering;
- [x] a locale matrix across at least one Latin, one Cyrillic, one CJK and one RTL
      locale;
- [x] a timezone test proving no value shifts a day.

**Done when:** CI runs the suite on every push and it is green.

---

## Phase 4 — Packaging

**Status:** BLOCKED on D3, D4, D6.

1. `tsup` library build — ESM, CJS, `.d.ts`, `sideEffects: false`.
2. Correct `exports` map, including the stylesheet path if D3 produces one.
3. `files` allowlist so only `dist` and the license ship.
4. Verify the built artifact in a scratch consumer project, both ESM and CJS,
   TypeScript and plain JavaScript.
5. `npm pack` and inspect the tarball contents by hand. Publishing a package
   containing something unintended cannot be undone.

**Done when:** a local `npm install ./package.tgz` in a fresh app renders a
working picker.

---

## Phase 5 — First publish

**Status:** BLOCKED on D1, and on Phases 1 through 4.

**Operator approval required for the publish itself.** An agent may prepare
everything and must not run `npm publish`.

1. Confirm `/LICENSE` exists and matches the D1 outcome.
2. Flip `"private": false` in `package.json`.
3. Publish `0.1.0`, not `1.0.0` — signal that the API may still move.
4. Tag the release and write release notes.
5. Verify the published package installs from the registry into a clean project.

---

## Phase 6 — Demo and announcement

**Status:** BLOCKED on Phase 5. See D9.

1. Minimal demo app with a locale switcher, an RTL locale and a disabled-days
   example.
2. Deploy to GitHub Pages from CI; link it from the README and the repository
   description.
3. Only then consider announcing anywhere. **Announcing is outward-facing and
   needs explicit operator approval per venue.**

---

## Phase 7 — Steady state

- Triage issues per the D8 posture.
- Keep the parity contract green; it is the reason the component is trustworthy.
- If the source product ever adopts the package (D7), pin an exact version.

---

## Estimated effort

Rough, for a competent agent or developer working uninterrupted:

| Phase | Effort |
|---|---|
| 1 — Port | 2–3 hours |
| 2 — Styling | ~1 day |
| 3 — Tests | 1–2 days (the real cost) |
| 4 — Packaging | 2–4 hours |
| 5 — Publish | under an hour |
| 6 — Demo | half a day |

The component is already written and already correct. Almost everything left is
the work of making it *somebody else's* component: styling that assumes nothing,
tests that prove it, and packaging that does not surprise anyone.
