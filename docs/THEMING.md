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
| `--rldp-faint-foreground` | Weekday headers, placeholder, carets, the disabled field's focus ring |
| `--rldp-disabled-foreground` | Disabled days and months |
| `--rldp-border` | Field and popover border |
| `--rldp-border-strong` | Month and year pills |
| `--rldp-surface` | Pill background, disabled field |
| `--rldp-hover` | Nav and pill hover |
| `--rldp-accent` | Selected day, focused field border |
| `--rldp-accent-hover` | Selected day hover |
| `--rldp-accent-foreground` | Text on the accent, and the band drawn inside the focus ring on an accent-filled cell |
| `--rldp-accent-soft` | Day hover, active pill |
| `--rldp-accent-soft-foreground` | Text on the soft accent |
| `--rldp-today-ring` | Today's ring |
| `--rldp-error` | `hasError` border, and its focus ring |
| `--rldp-ring` | Focus outline colour on unfilled controls |
| `--rldp-radius` | Corner radius |
| `--rldp-radius-popover` | Popover corner radius |
| `--rldp-font` | Font family |
| `--rldp-font-size` | Base font size |
| `--rldp-cell-size` | Day cell size (44px; 36px with a fine primary pointer from 768px up) |
| `--rldp-popover-width` | Popover width |
| `--rldp-z-index` | Popover stacking |
| `--rldp-focus-width` | Focus outline thickness |
| `--rldp-shadow` | Popover shadow |

The palette is authored in `oklch()` so hover and dark shades derive
predictably. Any valid CSS colour works as an override — hex is fine.

### Contrast the shipped themes meet

Measured in Chromium against the shipped stylesheet and pinned by
`e2e/bughunt-styles.spec.ts` for all four themes, in light and dark:

| Pair | Minimum |
| --- | --- |
| Placeholder and weekday headers on their background | 4.5:1 (7:1 in `high-contrast`) |
| Selected day and open month text on the accent | 4.5:1 (7:1 in `high-contrast`) |
| Focus on an accent-filled cell: the band against the fill, the ring against the popover | 3:1 |
| `hasError` border and the today ring on their background | 3:1 |

The open year uses the same accent pair as the open month.

The resting field and popover borders are not in this table: in `default`
and `soft` they are a hairline (about 1.2:1 in light, 1.7:1 in dark) and in
`minimal` they are transparent, by design. If your form relies on the border alone to show
where the field is, set `--rldp-border` to a colour with 3:1 against the
page, or use `high-contrast`.

If you override tokens, these are the pairs to re-check. Disabled days and
months are inactive controls and are exempt (WCAG 1.4.3); the placeholder is
not, because on an empty field it is the only statement of the `dd.MM.yyyy`
format.

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
  on any ancestor — compatible with next-themes and similar. The **nearest**
  one wins, so a `.dark` card on a `.light` page is dark. (Before 0.6.0 the
  later rule won whichever was nearer.)
- Or set `--rldp-color-scheme: dark` (or `light`) on any element yourself;
  the classes above only set that property.

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
- Read that guarantee literally, because it is not only a benefit: a CSS
  **reset** is unlayered consumer CSS too, and it wins on exactly the same
  terms. Tailwind's preflight resets `color`, `font-size` and
  `background-color` on `button, input, …` and `border-width` on `*`, so on
  those properties the picker's tokens never land — most visibly on the field
  and on disabled day cells. Anything this package styles on a `<button>` or
  an `<input>` needs an explicit class from the consumer; see
  [the README](../README.md#tailwind-preflight-beats-the-packages-own-styling)
  for the full table and the two ways out.
- Tokens are defined on the component root, never `:root`, so two
  differently themed pickers coexist on one page.
- Forced-colors mode (outline focus cues, `GrayText` disabled days),
  `prefers-reduced-motion` and printing (selected and current cells keep
  their fill) are handled in the shipped stylesheet.
- On browsers without `light-dark()` (Safari < 17.5, Chrome < 123, Firefox
  < 120) the plain theme is restored from hex fallbacks, and the named themes
  degrade to it; fine detail such as hover tints is not reproduced there.

## A portaled popover

With `portal`, the popover is no longer a DOM descendant of the picker root.
The component copies the root's `--rldp-*` tokens, `color-scheme`, font
family, line height, letter spacing and direction onto it and keeps them
live, so ancestor theming still applies. What cannot follow it is a selector
**scoped under your own ancestor**: `.my-form [data-part="day"]` no longer
matches a portaled day. Style the popover through `classNames` / `styles`, or
with unscoped `[data-part]` selectors.
