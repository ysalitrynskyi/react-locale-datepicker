// Regression guards for the 2026-10-01 pre-release review of 0.6.0. Each
// test names its entry in docs/bug-hunts/2026-10-01.md.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { isoLocal, localDate, renderPicker } from "./helpers";

// jsdom has no PointerEvent, so the type is defined on a plain event.
const tapWith = (el: HTMLElement, pointerType: string) => {
  const down = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(down, "pointerType", { value: pointerType });
  act(() => {
    el.dispatchEvent(down);
  });
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
  act(() => {
    el.dispatchEvent(click);
  });
};

const trigger = () => document.querySelector<HTMLElement>('[data-part="trigger"]')!;

// A focusable control outside the widget, removed after every test so a
// failure cannot leave a second textbox behind for the next one.
let outside: HTMLInputElement | null = null;
const outsideInput = () => {
  outside = document.createElement("input");
  document.body.append(outside);
  return outside;
};
afterEach(() => {
  outside?.remove();
  outside = null;
});

describe("leaving from inside the calendar still fires onBlur (RV-03)", () => {
  it("a press outside after moving into the grid fires onBlur once", async () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    act(() => h.input().focus());
    await h.user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toHaveAttribute("data-day");

    // The closing render unmounts the focused day, and an unmounted control
    // fires no blur: without handling this here the parent never heard it.
    fireEvent.mouseDown(document.body);
    expect(h.queryDialog()).toBeNull();
    expect(onBlur, "leaving from the grid must reach the parent").toHaveBeenCalledTimes(1);
    expect(isoLocal(onBlur.mock.calls[0][0])).toBe("2026-07-15");

    // Wherever focus goes next, leaving is not reported again.
    const next = outsideInput();
    act(() => next.focus());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("a blur that arrives before the calendar unmounts is not reported twice", async () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    act(() => h.input().focus());
    await h.user.keyboard("{ArrowDown}{ArrowDown}");
    const day = document.activeElement as HTMLElement;
    const next = outsideInput();
    // The press and the focus move it causes, before React re-renders: the
    // still-mounted day blurs toward the outside input.
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      next.focus();
    });
    expect(day.isConnected).toBe(false);
    expect(onBlur, "one exit, one onBlur").toHaveBeenCalledTimes(1);
  });

  it("each exit is reported: leave, come back, leave again", () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    const input = h.input();
    const next = outsideInput();
    act(() => input.focus());
    act(() => next.focus());
    expect(onBlur).toHaveBeenCalledTimes(1);
    // The once-per-exit guard is lifted when focus returns. If it were not,
    // the first exit would be the last one the parent ever heard about.
    act(() => input.focus());
    act(() => next.focus());
    expect(onBlur, "the second exit must be reported too").toHaveBeenCalledTimes(2);
  });

  it("a finger pick made with focus inside the calendar fires onBlur with that day", () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    fireEvent.mouseDown(trigger());
    const day = h.dayButton(20);
    // Focus is on a day (the visitor arrowed into the grid) when a finger
    // picks one. The calendar closes without returning focus to the field,
    // which would raise the keyboard, so focus has left the widget.
    act(() => day.focus());
    tapWith(day, "touch");
    expect(h.queryDialog()).toBeNull();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(isoLocal(onBlur.mock.calls[0][0])).toBe("2026-07-20");
  });

  it("a finger pick that leaves focus in the field does not fire onBlur yet", () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    act(() => h.input().focus());
    fireEvent.mouseDown(trigger());
    act(() => h.input().focus());
    // A tap does not move focus: it is still in the field.
    tapWith(h.dayButton(20), "touch");
    expect(document.activeElement).toBe(h.input());
    expect(onBlur).not.toHaveBeenCalled();
  });
});

describe("onBlur reports the latest commit (RV-05)", () => {
  it("a later commit replaces the date an outside press committed", () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    const h = renderPicker({ locale: "en", onBlur, onChange });
    act(() => h.input().focus());
    fireEvent.click(h.input(), { detail: 1 });
    fireEvent.change(h.input(), { target: { value: "15.03.2026" } });
    // A press outside that does not take focus, such as the touchstart of a
    // scroll gesture, commits the typed date and closes the calendar.
    fireEvent.touchStart(document.body);
    expect(isoLocal(onChange.mock.calls.at(-1)![0])).toBe("2026-03-15");
    expect(document.activeElement).toBe(h.input());

    fireEvent.change(h.input(), { target: { value: "16.03.2026" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    expect(isoLocal(onChange.mock.calls.at(-1)![0])).toBe("2026-03-16");

    fireEvent.blur(h.input());
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(isoLocal(onBlur.mock.calls[0][0]), "onBlur must not hand back the 15th").toBe(
      "2026-03-16",
    );
  });

  // A parent that owns the value directly, so the test decides when (and
  // whether) a commit comes back as the new value.
  const picker = (value: Date | null, onChange: () => void, onBlur: () => void) => (
    <LocaleDatePicker
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      locale="en"
      placeholder="dd.mm.yyyy"
    />
  );
  const typeAndConfirm = (text: string) => {
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: "Enter" });
    return input;
  };

  it("a commit the parent has not rendered yet still reaches onBlur", () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    render(picker(null, onChange, onBlur));
    const input = typeAndConfirm("16.03.2026");
    expect(isoLocal(onChange.mock.calls.at(-1)![0])).toBe("2026-03-16");

    // The parent applies it later (after a request, in a transition): the
    // blur comes first and must carry the commit, not the stale null.
    fireEvent.blur(input);
    expect(isoLocal(onBlur.mock.calls[0][0])).toBe("2026-03-16");
  });

  it("a value the parent sets after a commit is what onBlur reports", () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    const view = render(picker(null, onChange, onBlur));
    const input = typeAndConfirm("16.03.2026");
    view.rerender(picker(localDate(2026, 2, 16), onChange, onBlur));
    // The parent then moves the date itself. The recorded commit is older
    // than the value now and must not be handed back in its place.
    view.rerender(picker(localDate(2026, 2, 20), onChange, onBlur));

    fireEvent.blur(input);
    expect(isoLocal(onBlur.mock.calls[0][0]), "the parent's own value, not the 16th").toBe(
      "2026-03-20",
    );
  });
});

describe("first-letter casing is titlecase, not upper case (RV-04)", () => {
  const isMkhedruli = (s: string) => {
    const cp = s.codePointAt(0) ?? 0;
    return cp >= 0x10d0 && cp <= 0x10ff;
  };

  it("Georgian keeps Mkhedruli; Mtavruli is an all-caps display script", () => {
    const h = renderPicker({ initialValue: localDate(2026, 5, 17), locale: "ka" });
    const echo = document.querySelector('[data-part="echo"]')!.textContent ?? "";
    expect(
      isMkhedruli(echo),
      `echo starts with U+${echo.codePointAt(0)?.toString(16)}`,
    ).toBe(true);
    fireEvent.mouseDown(trigger());
    expect(h.queryDialog()).not.toBeNull();
    const pill = document.querySelector('[data-part="month-pill"]')!.textContent ?? "";
    expect(isMkhedruli(pill), `month pill starts with U+${pill.codePointAt(0)?.toString(16)}`).toBe(
      true,
    );
  });

  it("a cased script still gets its first letter upper-cased", () => {
    renderPicker({ initialValue: localDate(2026, 5, 17), locale: "es" });
    const echo = document.querySelector('[data-part="echo"]')!.textContent ?? "";
    expect(echo.startsWith("Miércoles")).toBe(true);
  });
});
