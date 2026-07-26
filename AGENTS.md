# Agent Operating Guide

For AI agents working in this repository. Read this before editing anything.

## What this repository is

A published npm package: `react-locale-datepicker` (MIT, 0.1.0 shipped
2026-07-26). The component was extracted from a private commercial product,
lives in `src/`, and is covered by unit tests, a Playwright browser matrix and
CI. The extraction phases in [`docs/PLAN.md`](docs/PLAN.md) are complete
through Phase 5; what remains there is the demo (Phase 6) and steady state
(Phase 7).

Your job, unless the operator says otherwise, is maintenance and the roadmap:
triage against the parity contract, keep the suite green, and take new work
from [`docs/ROADMAP.md`](docs/ROADMAP.md) — respecting its decision gates
(D10 onward) — rather than inventing scope.

## Read first, in this order

1. `docs/PLAN.md` — the phased plan and where it currently stands.
2. `docs/DECISIONS.md` — every open decision, each with a recommendation. Some
   are **blocking**; check before you write code that depends on one.
3. `docs/API.md` — the intended public surface.
4. `docs/EXTRACTION.md` — behaviour that must not regress during the port.
5. `LOCAL-CONTEXT.md` — **gitignored, local only.** Where the source component
   lives on this machine, and provenance notes. If it is missing, ask the
   operator rather than guessing; do not reconstruct it from memory and do not
   commit it.

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
- Comments explain *why*, not *what*. The source component's comments are
  unusually dense for exactly this reason — preserve that when porting.
- Commit messages: imperative subject under ~70 chars, body explaining the
  reasoning. Plain correct English in all repository artifacts.
- No emoji in code, commits, or documentation.
- One logical change per commit.

## Before you commit

1. `git status --short --branch` and review the diff.
2. Confirm nothing from the private source repository leaked — names, paths,
   business logic. Grep your diff for the product's domain terms if unsure.
3. Run whatever gates exist at that point in the plan (`npm run check` once it
   exists).
4. Commit only intentional files. Never commit `LOCAL-CONTEXT.md`.

## Working with the operator

- The operator decides everything in `docs/DECISIONS.md` marked **blocking**.
  Bring them a recommendation, not an open question.
- Report honestly. If a test is skipped or a locale is unverified, say so.
- Outward-facing actions — publishing the package, making a release, changing
  repository visibility or settings — need explicit approval each time. Prior
  approval for one does not carry to the next.
