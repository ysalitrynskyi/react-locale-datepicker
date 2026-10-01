# Agent Operating Guide

For AI agents working in this repository. Read this before editing anything.

Walk-up: `~/work/AGENTS.md`. **SSH:** host confirm. **Azure Foundry ON** (`azure_image`; `azure-enabled.md`).

## What this repository is

A published npm package, `react-locale-datepicker` (MIT). The latest release
is **0.6.1** (2026-10-01: a patch to 0.6.0, the bug-hunt release, on npm with
tags and GitHub releases for both), and `main` carries it until the next
release is prepared ([`docs/RELEASING.md`](docs/RELEASING.md)). The component was extracted from
a private commercial product. The extraction in
[`docs/PLAN.md`](docs/PLAN.md) is finished (Phases 0–6; only announcing is
open, and that needs per-venue approval); the project is in Phase 7, steady
state.

Your job, unless the operator says otherwise, is maintenance and the roadmap:
triage against the parity contract, keep the suite green, and take new work
from [`docs/ROADMAP.md`](docs/ROADMAP.md) — respecting its decision gates
(D10 onward) — rather than inventing scope.

## Read first, in this order

1. `docs/PLAN.md` — where the project stands, every release so far, and the
   two lessons at the end of Phase 7.
2. `docs/API.md` — the public surface and § Contracts that must not be
   broken.
3. `docs/EXTRACTION.md` § Parity contract — behaviour that must not regress.
4. `docs/DECISIONS.md` — every decision (D1–D22) with its reasoning. Read the
   one covering any behaviour you are about to change; an open one marked
   **blocking** is the operator's to decide.
5. `docs/TESTING.md` — how to run the suite, its local caveats, and the rules
   a new test must follow.
6. `LOCAL-CONTEXT.md` — **gitignored, local only.** Where the source component
   lives on this machine, and provenance notes. If it is missing, ask the
   operator rather than guessing; do not reconstruct it from memory and do not
   commit it.

Then as needed: `docs/ROADMAP.md` (planned work), `docs/RELEASING.md`
(release gates and order), `docs/THEMING.md` and `docs/ANATOMY.md` (the
styling surface), `CHANGELOG.md`, and `docs/bug-hunts/` (external reviews,
each finding mapped to the commit and test that resolved it).

## Map of the code

| Path | What |
|---|---|
| `src/LocaleDatePicker.tsx` | The whole component and its helpers in one file: locale resolution, date maths, input masking, focus and keyboard, portal placement. Comments say why each behaviour exists, usually naming the bug it prevents. |
| `src/styles.css` | Shipped as `react-locale-datepicker/styles.css`. Everything inside `@layer rldp` and `:where()`; public `--rldp-*` tokens; four named themes. |
| `src/index.ts` | The public exports. |
| `tests/` | Vitest and Testing Library in jsdom. `tests/bughunt-*` guard the 2026-09-30 findings by id. |
| `e2e/` | Playwright specs and the harness page they drive (`e2e/harness/`). |
| `examples/` | The demo on GitHub Pages. It installs the built package (`file:..`) and never imports `../src`. |

## Gates

```bash
npm run check                  # typecheck (src, tests, e2e), lint, unit tests
npm run test:tz                # unit tests under four timezones
npm run test:e2e               # Playwright matrix; read TESTING.md first
npm run build && npm pack --dry-run
```

CI runs the first three on every push, with Firefox and WebKit installed.
Run all of them before a commit that touches `src/`; check that each command
exited zero rather than reading the tail of piped output.

## Things that bite

- **The React Compiler lint rules are on** (`eslint-plugin-react-hooks`
  recommended). Reading a ref during render, calling `setState` in an effect
  and manual memoization the compiler cannot preserve are all errors. The
  component derives state during render instead (see the `seenValueKey`
  block) and syncs refs in a layout effect.
- **jsdom has no layout, no `PointerEvent` and no computed `direction`.**
  Geometry, cascade and contrast assertions belong in `e2e/`. TESTING.md says
  how to fake a pointer type in a unit test.
- **`npm run test:e2e` reuses any server already on port 5173**, which may be
  another checkout's harness. TESTING.md has the workaround.
- **A green local type-check can still fail on CI** if a parent directory
  holds `node_modules/@types` (TypeScript searches upward). Both tsconfigs
  pin `types` for that reason; keep them pinned (see D6).
- **The field and its calendar are one widget** (D21): `onBlur` fires when
  focus leaves both, Tab closes the calendar, ArrowDown enters it. Code that
  listens for the input's own blur is almost always wrong here, and closing
  the calendar under a focused control fires no blur at all: whatever closes
  it has to report the exit itself.
- **A test proves nothing until it has failed.** Twelve findings of the
  2026-09-30 review were tests that passed with their behaviour deleted;
  break the guarded code and watch the test go red before trusting it.
- **Vocabulary leaks.** Grep every diff's added lines for the domain terms in
  `LOCAL-CONTEXT.md` § Naming to strip before committing. Ordinary English can
  collide with them; reword rather than ignore a hit.

## Hard rules

- **This repository is PUBLIC. The source product repository is PRIVATE.**
  Never commit the private repo's name, its filesystem path, its internal URLs,
  customer data, API contracts, business rules, pricing logic, or analytics
  identifiers. When a doc needs to refer to the source, say "the source product
  repository" and keep specifics in the gitignored `LOCAL-CONTEXT.md`.
- **Every npm publish needs explicit operator approval for that specific
  release.** D1 is resolved (MIT, copyright the operator, since 0.1.0) and the
  package is public — that changes nothing about the per-release gate. Prepare
  releases freely; never run `npm publish` yourself.
- **Do not change `/LICENSE`, the `license` field, or the copyright line on
  your own initiative.** Licensing is an ownership assertion and stays the
  operator's call.
- **Do not modify the source product repository from here.** It has its own
  agent and its own rules. If the port needs a change there, write the request
  down and hand the operator a prompt.
- **Every behaviour in `docs/EXTRACTION.md` § Parity contract is load-bearing.**
  Each line exists because a real bug was found and fixed. Deleting one because
  it looks redundant re-introduces that bug. If you believe one is genuinely
  obsolete, write down why and leave it in place.
- **No dependency may be added without a recorded decision.** The goal is zero
  runtime dependencies. See D3.

## Conventions

- TypeScript, strict. The public API is fully typed and types ship with the
  package.
- Comments explain *why*, not *what*. The component's comments are unusually
  dense for exactly this reason; keep new code to the same standard.
- Commit messages: imperative subject under ~70 chars, body explaining the
  reasoning. Plain correct English in all repository artifacts.
- No emoji in code, commits, or documentation.
- One logical change per commit.

## Before you commit

1. `git status --short --branch` and review the diff.
2. Confirm nothing from the private source repository leaked — names, paths,
   business logic. Grep the diff's added lines for the domain terms in
   `LOCAL-CONTEXT.md`.
3. Run the gates (§ Gates); `npm run check` at minimum.
4. Commit only intentional files. Never commit `LOCAL-CONTEXT.md`.
5. A behaviour change needs a `CHANGELOG.md` entry under *Changed*: the
   source product pins an exact version and upgrades by reading it (D7).

## Working with the operator

- The operator decides everything in `docs/DECISIONS.md` marked **blocking**.
  Bring them a recommendation, not an open question.
- Report honestly. If a test is skipped or a locale is unverified, say so.
- Outward-facing actions — publishing the package, making a release, changing
  repository visibility or settings — need explicit approval each time. Prior
  approval for one does not carry to the next.
