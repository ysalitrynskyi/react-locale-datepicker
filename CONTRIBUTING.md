# Contributing

Thanks for considering it.

> **This project is pre-release.** There is no shipping code yet and no license
> has been applied — see `docs/DECISIONS.md` (D1). Until a license exists, please
> hold off on code contributions; there is no framework yet for accepting them.
> Issues and design feedback are welcome now.

## Good first contributions, once code lands

- **Locale reports.** The component derives everything from `Intl`, so the most
  valuable report is "in locale X, this renders wrong" with a screenshot. Use
  the locale issue template.
- **Timezone reports.** If a date shifts by a day, that is a serious bug. Include
  your timezone.
- **Accessibility findings**, particularly screen reader behaviour, which is hard
  to test automatically.

## Before opening a pull request

1. Open an issue first for anything beyond a small fix. It avoids wasted work.
2. Read `docs/EXTRACTION.md` § Parity contract. Every item there guards a real
   bug. A change that violates one will not be merged without a strong argument.
3. Add a test. See `docs/TESTING.md` for what the suite must cover.
4. Run `npm run check` and make sure it is green.

## Standards

- TypeScript, strict mode.
- Comments explain *why*, not *what*.
- No new runtime dependencies without discussion — zero dependencies is a design
  goal, not an accident.
- Plain, correct English in code, comments, commits and documentation. No emoji.
- Commit subjects in the imperative, under about 70 characters, with a body
  explaining the reasoning where it is not obvious.

## What will not be accepted

- Changes that break a documented contract in `docs/API.md` without a major
  version and a clear migration note.
- Reformatting or restructuring mixed into a functional change.
- New dependencies for functionality that a few lines of code would cover.
- Deleting a parity-contract behaviour because it appears redundant. It is
  probably the one holding a bug shut.

## Reporting a security issue

See `SECURITY.md`. Do not open a public issue for a vulnerability.
