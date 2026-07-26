# react-locale-datepicker

A React date picker that localizes itself from the `Intl` API — every locale the
browser knows, no locale files to register, right-to-left aware.

> **Status: ported, pre-release.** The component is in [`src/`](src/) and
> type-checks under strict mode; styling, tests and packaging are still ahead
> and nothing has been published to npm. Start with
> [`docs/PLAN.md`](docs/PLAN.md).

## Why another date picker

Most React date pickers ask you to import and register a locale bundle per
language. That is fine for two or three languages and painful for thirty. This
one derives month names, weekday names, the first day of the week and the
long-form date echo from `Intl.DateTimeFormat` at runtime, so adding a language
means passing a different string.

Planned characteristics, all of them already proven in the production component
this is extracted from:

- **Localization with no locale files.** Month and weekday names, week start and
  the spoken-form date echo all come from `Intl`.
- **RTL by construction.** Arabic and Hebrew lay out correctly because direction
  is derived, not hardcoded.
- **One tap to select.** Clicking a day commits and closes. No confirm button.
- **Typing that survives mobile.** Digits are masked into the display format as
  you type, because an iOS numeric keypad has no separator keys. Eastern
  Arabic-Indic digits are normalized.
- **A readable echo under the field.** The committed date is restated in words
  via `Intl`, so a US/EU month-day mix-up is visible immediately.
- **Timezone-safe values.** Values are local-midnight `Date` objects — never
  silently shifted a day by a UTC round trip.
- **Caller-owned disabled days.** A single `shouldDisableDate` predicate is the
  authority on what is selectable.
- **Accessible.** Keyboard navigation, `aria-label` / `aria-invalid` /
  `aria-describedby` pass-through, focus management on open and close.

## Provenance

The component was written for, and is in production on, a multilingual
travel-insurance checkout serving 33 locales. It replaced a heavier third-party
picker that shipped English month names to every non-English locale. It has been
exercised across Chromium, Firefox and WebKit at viewport widths from 320px to
1920px in Latin, Cyrillic, CJK and RTL locales.

That origin is why the API looks the way it does: it was shaped by a real
checkout where a mis-entered date costs a sale, not by a component gallery.

## Documentation

| Document | What it covers |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Phased implementation plan — start here |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Open decisions, each with a recommendation |
| [`docs/API.md`](docs/API.md) | Proposed public API surface |
| [`docs/EXTRACTION.md`](docs/EXTRACTION.md) | Porting rules and behaviour that must not regress |
| [`docs/TESTING.md`](docs/TESTING.md) | Required test matrix |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Post-extraction feature and theming roadmap |
| [`docs/RELEASING.md`](docs/RELEASING.md) | Versioning and npm publish process |
| [`AGENTS.md`](AGENTS.md) | Operating guide for AI agents working in this repo |

## License

**Not yet licensed.** No license file means all rights are reserved by default,
which is deliberate until ownership is confirmed — see decision **D1** in
[`docs/DECISIONS.md`](docs/DECISIONS.md). MIT text is staged at
[`docs/LICENSE-MIT.txt`](docs/LICENSE-MIT.txt) and moves to `/LICENSE` once that
decision is made. **Do not publish to npm before then.**
