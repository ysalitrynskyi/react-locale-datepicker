# Theming

Everything visual routes through `--rldp-*` custom properties. There are four
ways in, from least to most invasive: set a token, name a shipped theme,
override a slot with `classNames` / `styles`, or drop the stylesheet entirely
and style [the anatomy](ANATOMY.md).

## Setting tokens

Set any token **anywhere up the tree** — on an ancestor, or on the picker
root through `className`. The nearest declaration wins, because tokens are
ordinary inherited custom properties.

```css
.my-form {
  --rldp-accent: oklch(0.55 0.18 250);
  --rldp-radius: 0.5rem;
}
```

> Tokens set on an ancestor did **not** work in 0.1.0, despite being
> documented. The stylesheet declared every token on the picker root itself,
> and an element's own declaration always beats an inherited value. Fixed in
> 0.2.0; see [DECISIONS.md](DECISIONS.md) D10.

### Tokens

| Token | What it paints |
| --- | --- |
| `--rldp-background` | Field and popover background |
| `--rldp-foreground` | Primary text |
| `--rldp-muted-foreground` | Echo, nav glyphs |
| `--rldp-faint-foreground` | Weekday headers, carets |
| `--rldp-disabled-foreground` | Disabled days, placeholder |
| `--rldp-border` | Field and popover border |
| `--rldp-border-strong` | Month and year pills |
| `--rldp-surface` | Pill background, disabled field |
| `--rldp-hover` | Nav and pill hover |
| `--rldp-accent` | Selected day, focused field border |
| `--rldp-accent-hover` | Selected day hover |
| `--rldp-accent-foreground` | Text on the accent |
| `--rldp-accent-soft` | Day hover, active pill |
| `--rldp-accent-soft-foreground` | Text on the soft accent |
| `--rldp-today-ring` | Today's ring |
| `--rldp-error` | `hasError` border |
| `--rldp-ring` | Focus outline colour |
| `--rldp-radius` | Corner radius |
| `--rldp-radius-popover` | Popover corner radius |
| `--rldp-font` | Font family |
| `--rldp-font-size` | Base font size |
| `--rldp-cell-size` | Day cell size (44px, 36px on fine pointers) |
| `--rldp-popover-width` | Popover width |
| `--rldp-z-index` | Popover stacking |
| `--rldp-focus-width` | Focus outline thickness |
| `--rldp-shadow` | Popover shadow |

The palette is authored in `oklch()` so hover and dark shades derive
predictably. Any valid CSS colour works as an override — hex is fine.

## Named themes

Four themes ship: `default`, `minimal` (borderless, flat, typography-led),
`soft` (larger radii, filled surfaces) and `high-contrast` (AAA contrast
targets, thicker focus indicators).

From React:

```tsx
<LocaleDatePicker themeName="soft" /* ... */ />
```

From CSS only, on any ancestor:

```html
<div data-rldp-theme="soft">…</div>
```

Both do the same thing — the prop just stamps the attribute.

**Themes nest.** A theme applies to everything inside it, and the nearest one
wins:

```html
<div data-rldp-theme="soft">
  <!-- soft -->
  <div data-rldp-theme="minimal">
    <!-- minimal, not soft -->
  </div>
</div>
```

Leaving `themeName` unset stamps nothing, so an ancestor's theme still
applies. `themeName="default"` is therefore **not** the same as unset: it is
how you opt a picker back out of an ancestor's theme.

## Light and dark

No JavaScript, no flash of the wrong theme, correct during SSR.

- Follows the OS by default, via `color-scheme` and `light-dark()`.
- Override with a `.dark` / `.light` class or `[data-theme="dark"|"light"]`
  on any ancestor — compatible with next-themes and similar.

The package deliberately ships no theme-detection script. Apps own the
toggle. The consensus pre-paint snippet, if you need one:

```html
<script>
  const t = localStorage.theme ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
</script>
```

## Tailwind v4 bridge

Tailwind v4's `@theme` reads plain CSS variables, so a one-block alias maps
the picker onto your design tokens. Nothing Tailwind-specific ships in the
package.

```css
/* app.css */
@import "tailwindcss";
@import "react-locale-datepicker/styles.css";

@theme inline {
  /* Expose the picker's tokens to Tailwind utilities, e.g. bg-rldp-accent. */
  --color-rldp-accent: var(--rldp-accent);
  --color-rldp-background: var(--rldp-background);
}

/* And the direction that usually matters more: drive the picker from the
   Tailwind palette you already have. */
:root {
  --rldp-accent: var(--color-indigo-600);
  --rldp-accent-hover: var(--color-indigo-700);
  --rldp-accent-foreground: var(--color-white);
  --rldp-radius: var(--radius-lg);
}
```

Set those on a wrapper rather than `:root` if you want two differently
themed pickers on one page — the tokens are scoped by inheritance, not
global.

Utility classes still work per slot when you want them:

```tsx
<LocaleDatePicker
  classNames={{ popover: "shadow-2xl ring-1 ring-black/5" }}
  /* ... */
/>
```

## Cascade guarantees

- Every shipped rule sits in the `rldp` cascade layer and is written with
  `:where()`, so **unlayered consumer CSS always wins**, whatever the import
  order and whatever the selector.
- Tokens are defined on the component root, never `:root`, so two
  differently themed pickers coexist on one page.
- Forced-colors mode and `prefers-reduced-motion` are handled in the shipped
  stylesheet.
