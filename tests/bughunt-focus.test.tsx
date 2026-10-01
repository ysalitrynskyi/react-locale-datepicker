// Regression guards for the 2026-09-30 bug hunt: focus, blur and keyboard.
// Each test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { isoLocal, localDate, renderPicker } from "./helpers";

const active = () => document.activeElement as HTMLElement | null;
const roving = (dialog: HTMLElement) =>
  dialog.querySelector<HTMLElement>('[data-day][tabindex="0"]');

describe("blur means leaving the widget, not moving inside it (BH-014, BH-047)", () => {
  it("ArrowDown into the grid neither commits nor fires the parent blur", async () => {
    const onBlur = vi.fn();
    const onValidationError = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 7, 10),
      locale: "en",
      onBlur,
      onValidationError,
    });
    await h.openViaKeyboard();
    fireEvent.change(h.input(), { target: { value: "1" } });
    await h.user.keyboard("{ArrowDown}");
    expect(active()?.hasAttribute("data-day")).toBe(true);
    expect(onBlur).not.toHaveBeenCalled();
    expect(onValidationError).not.toHaveBeenCalled();
    expect(h.queryDialog()).not.toBeNull();
  });

  it("the second tap's own blur/focus keeps the draft", async () => {
    const onBlur = vi.fn();
    const onValidationError = vi.fn();
    const h = renderPicker({ locale: "en", onBlur, onValidationError });
    h.input().focus();
    fireEvent.click(h.input(), { detail: 1 }); // opens
    fireEvent.change(h.input(), { target: { value: "1" } });
    const touchClick = new MouseEvent("click", { bubbles: true, detail: 1 });
    Object.defineProperty(touchClick, "pointerType", { value: "touch" });
    act(() => {
      h.input().dispatchEvent(touchClick);
    });
    expect(h.input()).toHaveAttribute("inputmode", "numeric");
    expect((h.input() as HTMLInputElement).value).toBe("1");
    expect(onBlur).not.toHaveBeenCalled();
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("Tab from the field closes the calendar, commits, and moves on", async () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    render(
      <>
        <LocaleDatePicker
          value={localDate(2026, 6, 15)}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="p"
          aria-label="Date"
          locale="en"
        />
        <button type="button">Next field</button>
      </>,
    );
    const input = screen.getByLabelText("Date");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.change(input, { target: { value: "25122027" } });
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.tab();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()?.textContent).toBe("Next field");
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2027-12-25");
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("keyboard focus leaving from inside the calendar closes it (BH-047)", async () => {
    const onBlur = vi.fn();
    render(
      <>
        <LocaleDatePicker
          value={localDate(2026, 6, 15)}
          onChange={() => {}}
          onBlur={onBlur}
          placeholder="p"
          aria-label="Date"
          locale="en"
        />
        <button type="button">Elsewhere</button>
      </>,
    );
    const input = screen.getByLabelText("Date");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(active()?.hasAttribute("data-day")).toBe(true);
    act(() => screen.getByText("Elsewhere").focus());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isoLocal(onBlur.mock.calls[0][0])).toBe("2026-07-15");
  });
});

describe("dismissal keeps field and value in agreement (BH-018, BH-040)", () => {
  it("an outside press on a non-focusable node commits the typed date", async () => {
    const onChange = vi.fn();
    render(
      <>
        <LocaleDatePicker
          value={null}
          onChange={onChange}
          placeholder="p"
          aria-label="Date"
          locale="en"
        />
        <div data-testid="chrome">page</div>
      </>,
    );
    const input = screen.getByLabelText("Date");
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "15.08.2026" } });
    fireEvent.mouseDown(screen.getByTestId("chrome"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-08-15");
  });

  it("closing from the trigger hands focus back to the field", async () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    expect(active()?.hasAttribute("data-day")).toBe(true);
    fireEvent.mouseDown(screen.getAllByRole("button", { hidden: true })[0]);
    expect(h.queryDialog()).toBeNull();
    expect(active()).toBe(h.input());
  });
});

describe("Enter belongs to the form unless the field is busy (BH-041)", () => {
  it("is not prevented in a closed field with a committed value", () => {
    renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => {
      screen.getByRole("textbox").dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
  });

  it("still confirms a typed date, and does not submit then", () => {
    const onChange = vi.fn();
    renderPicker({ locale: "en", onChange });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "15072026" } });
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => {
      input.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-15");
  });
});

describe("the field's padding opens the calendar (BH-042)", () => {
  it("a press on the field element itself opens", () => {
    const h = renderPicker({ locale: "en" });
    const field = document.querySelector<HTMLElement>('[data-part="field"]')!;
    fireEvent.mouseDown(field);
    expect(h.queryDialog()).not.toBeNull();
    expect(active()).toBe(h.input());
  });
});

describe("the keyboard cursor follows the view (BH-012, BH-050, BH-086, BH-087)", () => {
  it("a chevron moves the focused day into the new month (BH-012)", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 6, 15),
      locale: "en-US",
      onChange,
    });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    fireEvent.click(h.headerNext());
    await waitFor(() => {
      expect(active()?.getAttribute("data-day")).toBe("2026-7-15");
    });
    fireEvent.keyDown(active()!, { key: "Enter" });
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-08-15");
  });

  it("a pill click while a day is focused does not drop focus (BH-086)", async () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    const pill = h.dialog().querySelector<HTMLElement>('[data-part="month-pill"]')!;
    fireEvent.mouseDown(pill);
    fireEvent.click(pill);
    await waitFor(() => {
      expect(active()?.getAttribute("data-part")).toBe("month");
    });
    expect(active()?.getAttribute("aria-current")).toBe("true");
  });

  it("choosing a month or a year from the keyboard keeps focus in the calendar (BH-050)", async () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    await h.openViaKeyboard();
    await h.user.keyboard("{ArrowDown}");
    fireEvent.click(h.dialog().querySelector<HTMLElement>('[data-part="year-pill"]')!);
    await waitFor(() => expect(active()?.getAttribute("data-part")).toBe("year"));
    fireEvent.click(active()!); // activate the current year
    await waitFor(() => expect(active()?.getAttribute("data-part")).toBe("month"));
    fireEvent.click(active()!); // activate the current month
    await waitFor(() => expect(active()?.hasAttribute("data-day")).toBe(true));
    expect(h.queryDialog()).not.toBeNull();
  });

  it("ArrowDown from the field enters the months view too (BH-087)", async () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    await h.openViaClick();
    fireEvent.click(h.dialog().querySelector<HTMLElement>('[data-part="month-pill"]')!);
    h.input().focus();
    fireEvent.keyDown(h.input(), { key: "ArrowDown" });
    expect(active()?.getAttribute("data-part")).toBe("month");
  });
});

describe("month and year options have one tab stop and an arrow keymap (BH-046, BH-070)", () => {
  it("years: one tabindex 0, arrows and PageUp move it", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      today: localDate(2026, 5, 15),
      locale: "en",
    });
    await h.openViaClick();
    fireEvent.click(h.dialog().querySelector<HTMLElement>('[data-part="year-pill"]')!);
    const years = Array.from(
      h.dialog().querySelectorAll<HTMLElement>('[data-part="year"]'),
    );
    expect(years.length).toBeGreaterThan(100);
    expect(years.filter((y) => y.tabIndex === 0)).toHaveLength(1);
    const current = years.find((y) => y.tabIndex === 0)!;
    expect(current.textContent).toBe("2026");
    expect(current.getAttribute("aria-current")).toBe("true");
    current.focus();
    fireEvent.keyDown(current, { key: "ArrowUp" });
    expect(active()?.textContent).toBe("2023");
    fireEvent.keyDown(active()!, { key: "PageUp" });
    expect(active()?.textContent).toBe("2011");
    fireEvent.keyDown(active()!, { key: "Home" });
    expect(active()?.textContent).toBe("1906");
    expect(
      years.filter((y) => y.tabIndex === 0).map((y) => y.textContent),
      "the tab stop follows focus",
    ).toEqual(["1906"]);
  });

  it("months: arrows skip months outside minDate/maxDate", async () => {
    const h = renderPicker({
      initialValue: localDate(2026, 5, 15),
      minDate: localDate(2026, 3, 1),
      locale: "en",
    });
    await h.openViaClick();
    fireEvent.click(h.dialog().querySelector<HTMLElement>('[data-part="month-pill"]')!);
    const june = h.dialog().querySelector<HTMLElement>('[data-part="month"][tabindex="0"]')!;
    expect(june.getAttribute("aria-current")).toBe("true");
    june.focus();
    fireEvent.keyDown(june, { key: "Home" });
    expect(active()?.getAttribute("aria-label")).toBe("April");
  });

  it("opening the year list scrolls the list, never the page (BH-045)", async () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    try {
      const h = renderPicker({ initialValue: localDate(2026, 5, 15), locale: "en" });
      await h.openViaClick();
      spy.mockClear();
      fireEvent.click(h.dialog().querySelector<HTMLElement>('[data-part="year-pill"]')!);
      const calls = spy.mock.contexts.filter(
        (el) => (el as Element).getAttribute?.("data-part") === "year",
      );
      expect(calls).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Escape and the documents a portal lives in (BH-048, BH-080)", () => {
  it("Escape is marked handled", async () => {
    const h = renderPicker({ initialValue: localDate(2026, 6, 15), locale: "en" });
    await h.openViaClick();
    const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(h.queryDialog()).toBeNull();
  });

  it("a second picker taking keyboard focus closes the first", async () => {
    render(
      <>
        <LocaleDatePicker value={null} onChange={() => {}} placeholder="p" aria-label="A" />
        <LocaleDatePicker value={null} onChange={() => {}} placeholder="p" aria-label="B" />
      </>,
    );
    const a = screen.getByLabelText("A");
    const b = screen.getByLabelText("B");
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowDown" });
    act(() => b.focus());
    fireEvent.keyDown(b, { key: "ArrowDown" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("Escape and an outside press inside an iframe portal close the dialog", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    try {
      const idoc = iframe.contentDocument!;
      const host = idoc.createElement("div");
      const outside = idoc.createElement("button");
      idoc.body.append(host, outside);
      render(
        <LocaleDatePicker
          value={localDate(2026, 6, 15)}
          onChange={() => {}}
          placeholder="p"
          aria-label="Date"
          portal={host}
        />,
      );
      const trigger = document.querySelector<HTMLElement>('[data-part="trigger"]')!;
      fireEvent.mouseDown(trigger);
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();
      act(() => {
        idoc.dispatchEvent(new idoc.defaultView!.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      fireEvent.mouseDown(trigger);
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();
      act(() => {
        outside.dispatchEvent(new idoc.defaultView!.MouseEvent("mousedown", { bubbles: true }));
      });
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      iframe.remove();
    }
  });
});

describe("a portaled calendar in field tab order (BH-051)", () => {
  it("Tab out of its last control lands on the next field", async () => {
    render(
      <>
        <LocaleDatePicker
          value={localDate(2026, 6, 15)}
          onChange={() => {}}
          placeholder="p"
          aria-label="Date"
          locale="en"
          portal
        />
        <button type="button">After</button>
      </>,
    );
    const input = screen.getByLabelText("Date");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const day = active()!;
    expect(day.hasAttribute("data-day")).toBe(true);
    fireEvent.keyDown(day, { key: "Tab" });
    expect(active()?.textContent).toBe("After");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Shift+Tab out of its first control returns to the field", async () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Date"
        locale="en"
        portal
      />,
    );
    const input = screen.getByLabelText("Date");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const dialog = screen.getByRole("dialog");
    const first = dialog.querySelector<HTMLElement>('[data-part="nav-previous"]')!;
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(active()).toBe(input);
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
});

describe("the grid always has a way in (BH-037, BH-055)", () => {
  it("opens on the first month with a selectable day", async () => {
    const h = renderPicker({
      today: localDate(2026, 8, 30),
      shouldDisableDate: (d) => d < localDate(2026, 10, 1),
      locale: "en",
    });
    await h.openViaClick();
    expect(within(h.dialog()).getByRole("grid", { name: /November 2026/ })).toBeTruthy();
    expect(roving(h.dialog())?.getAttribute("data-day")).toBe("2026-10-1");
  });

  it("a predicate that changes while open moves the tab stop to an enabled day", () => {
    const props = {
      value: null,
      onChange: () => {},
      placeholder: "p",
      "aria-label": "Date",
      locale: "en",
      today: localDate(2026, 8, 30),
      defaultCalendarMonth: localDate(2026, 8, 1),
    };
    const { rerender } = render(
      <LocaleDatePicker {...props} shouldDisableDate={() => true} />,
    );
    fireEvent.mouseDown(document.querySelector('[data-part="trigger"]')!);
    rerender(<LocaleDatePicker {...props} shouldDisableDate={() => false} />);
    const stop = roving(screen.getByRole("dialog"))!;
    expect(stop.getAttribute("aria-disabled")).toBeNull();
    expect(stop.getAttribute("data-day")).toBe("2026-8-30");
  });
});
