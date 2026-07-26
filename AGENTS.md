# Agent Operating Guide

For AI agents working in this repository. Read this before editing anything.

## What this repository is

An extraction-in-progress. A date picker component that runs in production
inside a private commercial product is being lifted out into a standalone,
publishable package. **The component source is not here yet.** This repo holds
the plan, the API design, the open decisions and the scaffolding.

Your job, unless the operator says otherwise, is to work through
[`docs/PLAN.md`](docs/PLAN.md) in order.

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
- **Do not publish to npm** until decision **D1** (ownership and license) is
  resolved and `/LICENSE` exists. `package.json` is deliberately
  `"private": true` as a safety catch — leave it that way until D1 closes.
- **Do not add a `/LICENSE` file on your own initiative.** Applying a license is
  an ownership assertion, and that is the operator's call.
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
