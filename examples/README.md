# Demo

A minimal Vite app exercising `react-locale-datepicker`: a locale switcher
including two right-to-left locales, a disabled-days example, an opt-outs
example, and theme and colour-scheme toggles.

## It consumes the built package, on purpose

The dependency is `"react-locale-datepicker": "file:.."` and the imports use
the package name. It deliberately does **not** import `../src`.

That distinction is the whole value of the demo. Importing the source would
be simpler and would prove nothing about what ships: a source import cannot
catch a broken `exports` map, a missing `"use client"` banner, or a
stylesheet path that fails to resolve. Those are exactly the failures that
reach users and never reach the test suite.

Consequence: **build the package first.** The demo resolves `dist/`.

```bash
npm install && npm run build   # in the repository root
cd examples
npm install
npm run dev
```

`npm run build` here produces a static site in `examples/dist`.

## Deployment

`.github/workflows/pages.yml` builds this app and publishes it to GitHub
Pages. It is `workflow_dispatch` only until the operator enables Pages for
the repository — see the note at the top of that file.
