import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderPicker } from "./helpers";

/**
 * Touch behaviour: when the on-screen keyboard is allowed to appear, and where
 * the calendar is allowed to go once it does.
 *
 * All three behaviours here were reported from a live checkout on a phone, and
 * none of them is visible on a desktop — jsdom reports no pointer at all, which
 * is why the 172 tests that existed before this file all passed while the
 * product was broken on the device most of its buyers use.
 */

/** jsdom has no matchMedia. Install one that answers a fixed pointer type. */
function mockPointer(coarse: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: coarse,
    media: "(pointer: coarse)",
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
    onchange: null,
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  });
  return {
    /** Flip the pointer type on a hybrid device and notify subscribers. */
    set(next: boolean) {
      mq.matches = next;
      act(() => {
        listeners.forEach((cb) => cb());
      });
    },
  };
}

afterEach(() => {
  // Leaving a stub installed would silently make later suites "touch".
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, "matchMedia");
});

const inputMode = () => screen.getByRole("textbox").getAttribute("inputmode");

describe("touch: the keyboard waits for a second tap", () => {
  beforeEach(() => mockPointer(true));

  test("the field suppresses the keyboard until asked", async () => {
    renderPicker();
    await waitFor(() => expect(inputMode()).toBe("none"));
  });

  test("first tap opens the calendar and still suppresses the keyboard", async () => {
    const p = renderPicker();
    await waitFor(() => expect(inputMode()).toBe("none"));

    fireEvent.click(p.input(), { detail: 1 });

    await waitFor(() => expect(p.queryDialog()).toBeTruthy());
    // The tap focuses the field — that is unavoidable and harmless. What must
    // not happen is a keyboard, and inputMode="none" is what prevents it.
    expect(inputMode()).toBe("none");
  });

  test("a second tap on the text is read as intent to type", async () => {
    const p = renderPicker();
    await waitFor(() => expect(inputMode()).toBe("none"));

    fireEvent.click(p.input(), { detail: 1 });
    await waitFor(() => expect(p.queryDialog()).toBeTruthy());
    fireEvent.click(p.input(), { detail: 1 });

    await waitFor(() => expect(inputMode()).toBe("numeric"));
  });

  test("the keyboard is requested inside the gesture, not after it", async () => {
    // iOS Safari honours a programmatic focus() only while it is still
    // processing the gesture that caused it. Deferring the blur/focus pair to
    // a requestAnimationFrame leaves that window, and Safari declines silently
    // — the second tap does nothing at all, which is worse than the bug this
    // fixes. So the assertion is not "focus eventually lands" but "focus has
    // already landed by the time the click handler returns".
    const p = renderPicker();
    fireEvent.click(p.input(), { detail: 1 });
    await waitFor(() => expect(p.queryDialog()).toBeTruthy());

    fireEvent.click(p.input(), { detail: 1 });

    // Deliberately synchronous: no waitFor, no act, nothing awaited.
    expect(inputMode()).toBe("numeric");
    expect(document.activeElement).toBe(p.input());
  });

  test("intent lasts one interaction and does not survive a close", async () => {
    const p = renderPicker();
    await waitFor(() => expect(inputMode()).toBe("none"));

    fireEvent.click(p.input(), { detail: 1 });
    await waitFor(() => expect(p.queryDialog()).toBeTruthy());
    fireEvent.click(p.input(), { detail: 1 });
    await waitFor(() => expect(inputMode()).toBe("numeric"));

    // Close by clicking away, then reopen: the visitor is back to picking.
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(p.queryDialog()).toBeNull());
    await waitFor(() => expect(inputMode()).toBe("none"));
  });

  test('"immediate" restores the pre-0.5 behaviour for consumers who want it', async () => {
    renderPicker({ manualEntryOnTouch: "immediate" });
    // Never suppressed, at any point.
    await waitFor(() => expect(inputMode()).toBe("numeric"));
  });
});

describe("suppression does not depend on detecting the device", () => {
  test("a fine pointer gets the same attribute, and cannot tell", async () => {
    // inputMode governs the VIRTUAL keyboard only, so "none" is inert wherever
    // there is a physical one. Rendering it unconditionally is what keeps the
    // server and client markup identical — and that is not a nicety: the first
    // tap is the one that must not raise a keyboard, so anything decided after
    // mount is decided too late. A previous attempt detected the pointer after
    // hydration and left the attribute at "numeric" for the whole first tap.
    mockPointer(false);
    const p = renderPicker();
    await waitFor(() => expect(inputMode()).toBe("none"));
    fireEvent.click(p.input(), { detail: 1 });
    await waitFor(() => expect(p.queryDialog()).toBeTruthy());
  });

  test("the attribute is right in the very first render, before any event", () => {
    mockPointer(true);
    renderPicker();
    // Synchronous: no waitFor, no interaction, no effect has had to run.
    expect(inputMode()).toBe("none");
  });
});

describe("picking a day does not summon the keyboard", () => {
  test("touch: committing a day leaves the input unfocused", async () => {
    mockPointer(true);
    const p = renderPicker({ initialValue: new Date(2026, 7, 10) });
    await p.openViaClick();

    await act(async () => {
      fireEvent.click(p.dayButton(12), { detail: 1 });
    });

    await waitFor(() => expect(p.queryDialog()).toBeNull());
    expect(p.committed()).toBe("2026-08-12");
    // The regression, exactly: focus landing here is what raised the keyboard
    // over the form on the tap that was meant to finish the job.
    expect(document.activeElement).not.toBe(p.input());
  });

  test("mouse: committing a day returns focus to the field", async () => {
    mockPointer(false);
    const p = renderPicker({ initialValue: new Date(2026, 7, 10) });
    await p.openViaClick();

    await act(async () => {
      fireEvent.click(p.dayButton(12), { detail: 1 });
    });

    await waitFor(() => expect(p.queryDialog()).toBeNull());
    // No virtual keyboard exists here, so the focus return is free — and
    // dropping a mouse user onto <body> mid-form would be its own regression.
    expect(document.activeElement).toBe(p.input());
  });

  test("touch: a keyboard commit still returns focus", async () => {
    mockPointer(true);
    const p = renderPicker({ initialValue: new Date(2026, 7, 10) });
    await p.openViaClick();

    // detail 0 is what assistive tech and Enter-on-button produce. Someone
    // driving a phone from a Bluetooth keyboard must not be stranded on body.
    await act(async () => {
      fireEvent.click(p.dayButton(12), { detail: 0 });
    });

    await waitFor(() => expect(p.queryDialog()).toBeNull());
    expect(document.activeElement).toBe(p.input());
  });
});

describe("the calendar does not change sides while it is open", () => {
  const placement = () =>
    screen.getByRole("dialog").getAttribute("data-placement");

  beforeEach(() => mockPointer(true));

  test("a viewport that shrinks under the keyboard does not flip it", async () => {
    const p = renderPicker({ portal: true });
    await p.openViaClick();
    const opened = placement();

    // The on-screen keyboard takes roughly half the viewport. Before the fix
    // this collapsed spaceBelow, re-decided the side, and vaulted the calendar
    // over the field on the frame the keyboard appeared.
    //
    // 200, not 300: the value has to be one that WOULD flip, or this test
    // passes whether or not the freeze exists. At 300 the harness geometry
    // still leaves more room below (160) than above (100) and the component
    // legitimately stays put — which is how the first version of this test
    // sailed through with the freeze deleted.
    await act(async () => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 200,
      });
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    expect(placement()).toBe(opened);
  });

  test("a fresh open re-decides the side", async () => {
    // Freezing must last one open, not forever — otherwise a field that has
    // since scrolled to the bottom of the screen opens off-screen.
    //
    // 200 against the harness geometry (field top 100, bottom 140, popover 320)
    // leaves 60px below and 100px above, which is the only way to make the
    // component choose "top": it flips when neither side fits AND above is
    // roomier. 300 leaves 160 below and still picks "bottom" — the arithmetic
    // this test got wrong the first time, and worth stating so the next edit
    // does not repeat it.
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 200,
    });
    const p = renderPicker({ portal: true });
    await p.openViaClick();
    const cramped = placement();

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(p.queryDialog()).toBeNull());

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 2000,
    });
    await p.openViaClick();

    expect(cramped).toBe("top");
    expect(placement()).toBe("bottom");
  });
});
