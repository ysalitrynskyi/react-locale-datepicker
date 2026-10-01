// Regression guards for the 2026-10-01 pre-release review of 0.6.0. Each
// test names its entry in docs/bug-hunts/2026-10-01.md.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent } from "@testing-library/react";
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

  it("a day picked by a finger that focused it fires onBlur with that day", () => {
    const onBlur = vi.fn();
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en", onBlur });
    fireEvent.mouseDown(trigger());
    const day = h.dayButton(20);
    // Android Chrome focuses a tapped button; the calendar then closes
    // without returning focus to the field, so focus has left the widget.
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
    // iOS Safari does not focus a tapped button: focus is still in the field.
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
});
