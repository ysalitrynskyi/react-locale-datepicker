# Anatomy

The published styling contract. One canonical list — exported at runtime as
`ANATOMY` — drives three things at once, so they cannot drift apart:

1. the `data-part` attribute stamped on **every** element the component
   renders;
2. the keys of the `classNames` and `styles` props;
3. this document.

`data-part` values are kebab-case, because they get written into CSS
selectors. Slot keys are camelCase, because they are JavaScript identifiers.

This is also the headless escape hatch. "Unstyled mode" is simply not
importing `react-locale-datepicker/styles.css`: `data-part` plus the state
attributes below give you a complete contract with no stylesheet at all.

Parts are **never removed or renamed** — consumers write selectors against
them. The list only ever grows.

## Parts

| `data-part` | Slot key | Element |
| --- | --- | --- |
| `root` | `root` | Outer wrapper. Also takes the `className` prop. |
| `field` | `field` | The bordered input row. Carries `data-error` / `data-disabled`. |
| `input` | `input` | The text input. |
| `trigger` | `trigger` | Calendar toggle button beside the input. |
| `trigger-icon` | `triggerIcon` | Built-in calendar glyph. |
| `echo` | `echo` | Long-form committed date under the field. |
| `popover` | `popover` | The calendar dialog. Carries `data-placement`. |
| `header` | `header` | Header row of the popover. |
| `nav-previous` | `navPrevious` | Previous month (or year) button. |
| `nav-next` | `navNext` | Next month (or year) button. |
| `nav-icon` | `navIcon` | Built-in chevron in the two nav buttons. |
| `selects` | `selects` | Wrapper around the month and year pills. |
| `live-region` | `liveRegion` | Visually hidden polite region announcing the visible month and year. |
| `keyboard-help` | `keyboardHelp` | Visually hidden polite region carrying the one-time keyboard help. |
| `month-pill` | `monthPill` | Month button that opens the months view. Carries `data-active`. |
| `year-pill` | `yearPill` | Year button that opens the years view. Carries `data-active`. |
| `caret` | `caret` | Built-in chevron inside the two pills. |
| `grid` | `grid` | `role="grid"` wrapper for the days view. |
| `weekdays` | `weekdays` | Column header row. |
| `weekday` | `weekday` | One column header. |
| `days` | `days` | `role="rowgroup"` holding the week rows. |
| `week` | `week` | One week row. |
| `day-cell` | `dayCell` | `role="gridcell"` wrapper. Carries `aria-selected`. |
| `day` | `day` | The day button itself. |
| `day-blank` | `dayBlank` | Padding cell before the first or after the last day. |
| `months` | `months` | Months view grid. |
| `month` | `month` | One month button. Carries `data-current`. |
| `years` | `years` | Years view grid. |
| `year` | `year` | One year button. Carries `data-current`. |

## State-only slots

These address a **state** of a part rather than an element of its own. They
exist in `classNames` and `styles` only — there is no matching `data-part`.

| Slot key | Applies to |
| --- | --- |
| `daySelected` | The day matching `value`. |
| `dayDisabled` | A day `shouldDisableDate` rejects. |
| `dayToday` | Today, while it is not the selected day. |
| `monthCurrent` | The month shown in the days view. |
| `yearCurrent` | The year shown in the days view. |

`daySelected`, `dayDisabled`, `day`, `input`, `popover`, `header`, `grid` and
`echo` shipped in 0.1.0 and behave exactly as they did.

## State attributes

Present only when true, so `[data-selected]` is a sufficient selector.

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-error` | `field` | `hasError` is set. Visual only. |
| `data-disabled` | `field`, `day` | The picker, or that day, is not selectable. |
| `data-selected` | `day` | The day matches `value`. |
| `data-today` | `day` | The day is today **and** is not selected. |
| `data-placement` | `popover` | `top` or `bottom`, after the flip measurement. |
| `data-active` | `month-pill`, `year-pill` | That pill's view is open. |
| `data-current` | `month`, `year` | The month or year currently shown. |
| `data-day` | `day` | `YYYY-M-D` with a **0-based** month, matching `Date#getMonth`. |

## Styling without the stylesheet

```css
.my-picker [data-part="day"][data-selected] {
  background: rebeccapurple;
  color: white;
}
.my-picker [data-part="day"][data-today]:not([data-selected]) {
  outline: 1px dashed currentColor;
}
```

## Styling through the props

`classNames` appends to the built-in classes; it never replaces them.
`styles` sets inline styles, which win over everything the stylesheet does.
Both take state slots, which layer on top of the part's own entry.

```tsx
<LocaleDatePicker
  classNames={{ day: "my-day", daySelected: "my-day-selected" }}
  styles={{ popover: { borderRadius: 16 }, daySelected: { fontWeight: 700 } }}
  /* ... */
/>
```

The popover's measured horizontal offset is applied before your `popover`
entry, so styling it cannot strand the popup off screen.

## Using the list programmatically

```ts
import { ANATOMY } from "react-locale-datepicker";

// [{ part: "root", slot: "root" }, { part: "field", slot: "field" }, ...]
ANATOMY.map((entry) => entry.part);
```
