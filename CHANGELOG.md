# Changelog

## 0.1.0 — 2026-07-26

First public release.

### Features

- `LocaleDatePicker` React component with local-midnight `Date` values
- `resolveLocale` export (`ua` → `uk`, safe fallback for malformed tags)
- Self-contained stylesheet at `react-locale-datepicker/styles.css` with
  `--rldp-*` tokens, light/dark (OS + class/attribute), RTL, forced-colors
  and reduced-motion basics
- `className`, `classNames` (slot overrides) and `icons` props
- Masked `dd.MM.yyyy` typing with Eastern Arabic-Indic digit normalization
- Long-form echo pinned to the Gregorian calendar (agrees with the grid)
- Full keyboard map: arrows, Page/Shift+Page, Home/End, Enter/Space, Escape
- Day-cell accessible names lead with the day number (voice-control safe)
- Dual package: ESM + CJS + TypeScript declarations; `"use client"` banner
  for RSC consumers

### Quality

- Vitest + Testing Library parity-contract suite (timezone matrix in CI)
- Playwright: Chromium / Firefox / WebKit × 320 / 768 / 1280
