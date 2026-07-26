// The typed draft and the open calendar must not live in separate worlds.
// 0.2.0 shipped exactly that bug, reported from the live demo: typing a
// full date left the grid on the old month, separators could not be typed
// at all, and reopening the calendar ignored the uncommitted draft. Each
// test names the behaviour it pins.
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { localDate, renderPicker } from "./helpers";

describe("typed input and calendar synchronization", () => {
  it("navigates the open grid to a fully typed date (live-sync bug)", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 6, 18),
      defaultCalendarMonth: localDate(2026, 6, 1),
      locale: "en",
    });
    await h.openViaClick();
    expect(
      within(h.dialog()).getByRole("grid", { name: /July 2026/ }),
    ).toBeTruthy();

    fireEvent.change(h.input(), { target: { value: "05112027" } });
    await waitFor(() => {
      expect(
        within(h.dialog()).getByRole("grid", { name: /November 2027/ }),
      ).toBeTruthy();
    });
    // DOM focus must stay in the input mid-typing; only the roving target
    // moves. Stealing focus would interrupt the very typing being followed.
    expect(h.dayButton(5).getAttribute("tabindex")).toBe("0");
  });

  it("a partial draft does not yank the view (no wrong-year guessing)", async () => {
    const h = renderPicker({
      defaultCalendarMonth: localDate(2026, 6, 1),
      locale: "en",
    });
    await h.openViaClick();
    fireEvent.change(h.input(), { target: { value: "0511" } });
    expect(
      within(h.dialog()).getByRole("grid", { name: /July 2026/ }),
    ).toBeTruthy();
  });

  it("live-sync respects minDate/maxDate navigation clamping", async () => {
    const h = renderPicker({
      defaultCalendarMonth: localDate(2026, 6, 1),
      maxDate: localDate(2026, 11, 31),
      locale: "en",
    });
    await h.openViaClick();
    fireEvent.change(h.input(), { target: { value: "05112027" } });
    // Typed month is beyond maxDate; the view clamps to December 2026 the
    // same way every other navigation path does.
    await waitFor(() => {
      expect(
        within(h.dialog()).getByRole("grid", { name: /December 2026/ }),
      ).toBeTruthy();
    });
  });

  it("reopening the calendar shows the uncommitted typed month (reopen bug)", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 6, 18),
      locale: "en",
    });
    await h.openViaClick();
    fireEvent.change(h.input(), { target: { value: "10032027" } });
    // Close and reopen through the trigger: mousedown toggling never blurs
    // the input, so the draft stays uncommitted the whole time.
    const trigger = screen.getAllByRole("button")[0];
    fireEvent.mouseDown(trigger);
    expect(h.queryDialog()).toBeNull();
    fireEvent.mouseDown(trigger);
    await waitFor(() => {
      expect(
        within(h.dialog()).getByRole("grid", { name: /March 2027/ }),
      ).toBeTruthy();
    });
  });

  it("typing a separator closes the segment and pads it (dot bug)", async () => {
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "1." } });
    expect((h.input() as HTMLInputElement).value).toBe("01.");
    fireEvent.change(h.input(), { target: { value: "01.7." } });
    expect((h.input() as HTMLInputElement).value).toBe("01.07.");
    fireEvent.change(h.input(), { target: { value: "01.07.2026" } });
    expect((h.input() as HTMLInputElement).value).toBe("01.07.2026");
  });

  it("comma, Arabic comma and slash all work as separators", async () => {
    const h = renderPicker({ locale: "en" });
    for (const raw of ["1,7,2026", "1،7،2026", "1/7/2026"]) {
      fireEvent.change(h.input(), { target: { value: "" } });
      fireEvent.change(h.input(), { target: { value: raw } });
      expect((h.input() as HTMLInputElement).value).toBe("01.07.2026");
    }
  });

  it("a separator-typed date commits on Enter", async () => {
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "1.7.2026" } });
    fireEvent.keyDown(h.input(), { key: "Enter" });
    await waitFor(() => {
      expect(h.committed()).toBe("2026-07-01");
    });
  });

  it("pure-digit typing still masks exactly as before (parity guard)", async () => {
    const h = renderPicker({ locale: "en" });
    for (const [raw, masked] of [
      ["1", "1"],
      ["18", "18"],
      ["180", "18.0"],
      ["1807", "18.07"],
      ["18072", "18.07.2"],
      ["18072026", "18.07.2026"],
    ] as const) {
      fireEvent.change(h.input(), { target: { value: "" } });
      fireEvent.change(h.input(), { target: { value: raw } });
      expect((h.input() as HTMLInputElement).value).toBe(masked);
    }
  });
});
