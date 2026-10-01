# Testing

What the suite covers, how to run it, and the rules a new test has to follow.
Phase 3 built it from nothing (the original component's cross-browser checks
were never committed); everything since has added to it.

## Running it

```bash
npm run check        # typecheck (src, and tests + e2e via tsconfig.test.json), lint, unit
npm run test:tz      # the unit suite under UTC, America/Los_Angeles, Asia/Tokyo, Asia/Kathmandu
npm run test:e2e     # Playwright: Chromium, Firefox, WebKit at 320 / 768 / 1280 px
```

CI (`.github/workflows/ci.yml`) runs the same steps — type-check, lint, the
unit suite in all four timezones, and the browser matrix with all three
engines installed — on every push to `main` and every pull request. **A red
suite blocks a release.**

Local notes:

- `npm run test:e2e` starts the harness (`e2e/harness/`) on port 5173 and
  reuses a server already listening there. If another checkout or worktree is
  serving its own harness on 5173, your run silently tests *that* code. Stop
  it, or run with a copy of `playwright.config.ts` that points `baseURL` and
  the `webServer` command (`vite --config e2e/harness/vite.config.ts --port
  5174 --strictPort`) at another port.
- Only browsers installed for the pinned Playwright version run. `npx
  playwright install chromium firefox webkit` installs them; until then pass
  `--project=chromium-1280` (and friends) to run what you have, and say so.

## Layout of the suite

| Where | What |
|---|---|
| `tests/*.test.tsx` | Vitest + Testing Library in jsdom: behaviour, ARIA, masking, keyboard, values. |
| `tests/bughunt-*.test.tsx` | Regression guards for the 2026-09-30 bug hunt, each naming its ledger id (see [`bug-hunts/2026-09-30.md`](bug-hunts/2026-09-30.md)). |
| `tests/ssr-contract.test.tsx` | Runs under `@vitest-environment node`: the module imports and renders with no DOM. |
| `tests/consumer-contract.test.tsx` | Promises a consuming product relies on (display format, locale resolution, timezone). |
| `e2e/matrix.spec.ts`, `e2e/themes.spec.ts` | Real-browser behaviour, layout, theming. |
| `e2e/bughunt.spec.ts`, `e2e/bughunt-styles.spec.ts` | Real-layout guards jsdom cannot provide: direction, portal geometry, contrast ratios, forced colours, print, reflow at 200% text. |

jsdom has no layout, no `PointerEvent`, no computed `direction` and no colour
resolution, so anything about geometry, the cascade or contrast belongs in
e2e. When a unit test needs a pointer type, dispatch a plain `Event` and
define `pointerType` on it (see `tests/bughunt-pointer.test.tsx`).

## Rules for a test

1. **It must fail when the behaviour it names is removed.** Before trusting a
   new test, break the code it guards (delete the branch, no-op the effect)
   and watch it go red, then restore the code. Twelve findings in the
   2026-09-30 review were tests that passed against removed behaviour;
   asserting the presence of an element, or text that was already on screen,
   is the usual cause.
2. **Assert the observable result, not a proxy.** Where focus lands
   (`document.activeElement`), which date was committed, the whole accessible
   name — not "an onChange happened" or "the name contains the year".
3. **Name the bug in the failure message.** Most tests do not check that the
   component works; they check that a specific bug from
   [`EXTRACTION.md`](EXTRACTION.md) § Parity contract or a ledger entry stays
   fixed. Write the message so a future maintainer knows why the test must
   not be deleted.
4. **Values are built with local getters** (`localDate(y, m0, d)` in
   `tests/helpers.tsx`), never parsed from ISO strings, and the suite is
   expected to pass in every `TZ` above.

## Coverage the contract requires

All of these exist; keep them.

### Date arithmetic and values

- [x] A selected day commits as **local midnight**, in four timezones
      including a non-hour offset (`Asia/Kathmandu`, +05:45).
- [x] Month boundaries, leap-day 29 February, year-boundary navigation.
- [x] Years before the Unix epoch, years below 1000 and years 0–99.
- [x] Invalid, foreign-realm and range-edge Dates never crash or vanish.

### Locale

- [x] Month and weekday names from `Intl` for Latin (`de`), Cyrillic (`uk`),
      CJK (`ja`) and RTL (`ar`).
- [x] `ua`, `UA` and `ua-UA` resolve to Ukrainian and do not throw.
- [x] An unknown (`zz-ZZ`) or malformed (`en_US`) locale falls back.
- [x] The first day of the week follows the locale.
- [x] One numbering system per widget; `-u-nu-` opts into another.

### Input and masking

- [x] Digits mask into `dd.MM.yyyy`; separator keys from Latin, Arabic, CJK
      fullwidth and Cyrillic layouts separate.
- [x] Localized digits normalize for every decimal numbering system.
- [x] Mid-string edits, extra groups and year-first pastes never commit a
      different date; discarded edits create no draft; IME composition.
- [x] Paste, clearing, `form.reset()`, a parent value change, and `disabled`
      arriving while a draft exists.

### Interaction and focus

- [x] One tap on a day commits and closes; the post-pick click guard only
      covers the popover's footprint.
- [x] `shouldDisableDate` blocks selection by click and keyboard;
      `minDate`/`maxDate` bound navigation only.
- [x] Opening lands on `defaultCalendarMonth`, then today, then the first
      month with a selectable day.
- [x] `onBlur` receives the just-committed value and fires once, when focus
      leaves the widget.
- [x] `onDisabledOpenAttempt` fires from the field and from the icon.
- [x] Touch: the second-tap keyboard, and Safari's mismatched pointer types.

### Accessibility

- [x] `aria-label`, `aria-labelledby`, `id`, `aria-invalid`,
      `aria-describedby` reach the input with the exact expected spelling.
- [x] Full keyboard map (days, months, years), focus never left on `<body>` while
      open, Escape returns focus to the field.
- [x] axe passes on the whole open widget, not only the dialog.
- [x] Contrast pairs and focus visibility on every shipped theme (e2e).

### Layout

- [x] RTL layout, arrow keys and chevrons, including a portaled popover and
      an ancestor `dir="auto"`.
- [x] 320px viewport, 200% text at 320px, a short viewport (portaled).
- [x] An `overflow: hidden` card clips the in-tree popover (hit-tested) and
      not the portaled one.
