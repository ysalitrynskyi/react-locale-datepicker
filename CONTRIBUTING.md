# Contributing

Thanks for considering it. The package is published on npm
([`react-locale-datepicker`](https://www.npmjs.com/package/react-locale-datepicker))
under the MIT license, and contributions are welcome — issues, locale reports
and pull requests alike.

## Development setup

```bash
git clone https://github.com/ysalitrynskyi/react-locale-datepicker
cd react-locale-datepicker
npm install
npm run check        # typecheck + lint + unit tests
npm run test:tz      # unit suite under UTC, America/Los_Angeles, Asia/Tokyo
npm run test:e2e     # Playwright matrix (npx playwright install first)
npm run build        # tsup -> dist/ (ESM + CJS + d.ts + styles.css)
npm run screenshots  # regenerate README images and GIF from the harness
```

`npm run e2e:harness` serves the interactive harness at `localhost:5173` for
manual poking.

## Good first contributions

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
