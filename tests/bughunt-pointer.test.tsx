// Regression guards for the 2026-09-30 bug hunt: pointer handling.
// Each test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { localDate, renderPicker } from "./helpers";

// A click whose own pointerType is "mouse", as Safari 18.2+ reports for a
// finger (WebKit 282988), preceded by the pointerdown that tells the truth.
// jsdom has no PointerEvent, so the type is defined on a plain event.
const pointerDown = (el: HTMLElement, pointerType: string) => {
  const down = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(down, "pointerType", { value: pointerType });
  act(() => {
    el.dispatchEvent(down);
  });
};

const tapAsSafariReportsIt = (el: HTMLElement, pressedWith: string) => {
  pointerDown(el, pressedWith);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
  Object.defineProperty(click, "pointerType", { value: "mouse" });
  act(() => {
    el.dispatchEvent(click);
  });
};

describe("activation is read from pointerdown, not the click (BH-017)", () => {
  it("a finger Safari calls a mouse still gets the second-tap keyboard", () => {
    const h = renderPicker({ locale: "en" });
    h.input().focus();
    fireEvent.click(h.input(), { detail: 1 }); // first tap opens
    tapAsSafariReportsIt(h.input(), "touch");
    expect(h.input()).toHaveAttribute("inputmode", "numeric");
  });

  it("a day picked by that finger does not refocus the field", () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    (document.activeElement as HTMLElement | null)?.blur();
    tapAsSafariReportsIt(h.dayButton(20), "touch");
    expect(h.queryDialog()).toBeNull();
    expect(document.activeElement).not.toBe(h.input());
  });

  it("a pen is handled like a finger (BH-009, documented decision)", () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    (document.activeElement as HTMLElement | null)?.blur();
    tapAsSafariReportsIt(h.dayButton(20), "pen");
    expect(document.activeElement).not.toBe(h.input());
  });

  it("a real mouse still gets focus back after a pick", () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    tapAsSafariReportsIt(h.dayButton(20), "mouse");
    expect(document.activeElement).toBe(h.input());
  });
});

describe("a disabled picker's calendar icon reports the attempt (BH-010)", () => {
  it("is aria-disabled, not disabled, and calls onDisabledOpenAttempt", () => {
    const onDisabledOpenAttempt = vi.fn();
    renderPicker({ disabled: true, onDisabledOpenAttempt });
    const trigger = document.querySelector<HTMLElement>('[data-part="trigger"]')!;
    expect(trigger).not.toHaveAttribute("disabled");
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.mouseDown(trigger);
    expect(onDisabledOpenAttempt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the post-pick click guard only covers the popover's footprint (BH-016)", () => {
  const pickWithMouse = () => {
    const onClick = vi.fn();
    const utils = render(
      <>
        <LocaleDatePicker
          value={localDate(2026, 6, 15)}
          onChange={() => {}}
          placeholder="p"
          aria-label="Date"
          locale="en"
        />
        <button type="button" onClick={onClick}>
          Submit
        </button>
      </>,
    );
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    const day = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("data-day") === "2026-6-20")!;
    pointerDown(day, "mouse");
    fireEvent.click(day, { detail: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();
    return { onClick, ...utils };
  };

  it("a click elsewhere right after a pick reaches its target", () => {
    const { onClick } = pickWithMouse();
    // jsdom places every box at (20,100)-(300,140); (0,0) is outside it.
    fireEvent.click(screen.getByText("Submit"), { clientX: 0, clientY: 0 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("the double-click's second click, where the popover was, is swallowed", () => {
    const { onClick } = pickWithMouse();
    fireEvent.click(screen.getByText("Submit"), { clientX: 50, clientY: 120 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is removed when the picker unmounts", () => {
    const { onClick, unmount } = pickWithMouse();
    const outside = document.createElement("button");
    outside.addEventListener("click", onClick);
    document.body.appendChild(outside);
    unmount();
    fireEvent.click(outside, { clientX: 50, clientY: 120 });
    expect(onClick).toHaveBeenCalledTimes(1);
    outside.remove();
  });
});
