// Regression guards for the 2026-09-30 bug hunt: typed entry and draft state.
// Each test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { isoLocal, localDate, renderPicker } from "./helpers";

const valueOf = (el: HTMLElement) => (el as HTMLInputElement).value;

describe("separator keys from more layouts (BH-002)", () => {
  it.each([
    ["Arabic decimal separator", "1٫8٫2026"],
    ["Arabic decimal, Arabic-Indic digits", "١٫٨٫٢٠٢٦"],
    ["Arabic thousands separator", "1٬8٬2026"],
    ["ideographic full stop", "1。8。2026"],
    ["fullwidth full stop + digits", "１．８．２０２６"],
    ["fullwidth comma + digits", "１，８，２０２６"],
    ["fullwidth solidus", "1／8／2026"],
  ])("%s separates instead of closing the digits up", (_, raw) => {
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: raw } });
    expect(valueOf(h.input())).toBe("01.08.2026");
  });
});

describe("the mask never manufactures a different date", () => {
  it("an extra group is kept visible and rejected, not appended to the year (BH-003)", () => {
    const onChange = vi.fn();
    const onValidationError = vi.fn();
    const h = renderPicker({ locale: "en", onChange, onValidationError });
    fireEvent.change(h.input(), { target: { value: "1.2.3.2026" } });
    expect(valueOf(h.input())).not.toBe("01.02.3202");
    expect(valueOf(h.input())).toBe("01.02.3.2026");
    fireEvent.blur(h.input());
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith("impossible-date");
  });

  it.each([
    ["2012-03-15", "15.03.2012"],
    ["2026-07-17", "17.07.2026"],
    ["2026/7/5", "05.07.2026"],
    ["2012-06-15T00:00:00.000Z", "15.06.2012"],
    ["2026-07-15 14:30", "15.07.2026"],
  ])("a year-first paste %s is reordered to %s (BH-064)", (raw, shown) => {
    const onChange = vi.fn();
    const h = renderPicker({ locale: "en", onChange });
    fireEvent.change(h.input(), { target: { value: raw } });
    expect(valueOf(h.input())).toBe(shown);
    fireEvent.blur(h.input());
    const [dd, mm, yyyy] = shown.split(".");
    expect(isoLocal(onChange.mock.calls[0][0])).toBe(`${yyyy}-${mm}-${dd}`);
  });

  it("digits typed forward still roll day into month before a separator (by design)", () => {
    // "123." is day 12 and month 3: the same reading pure-digit typing has
    // always had. Recorded in the ledger as not a defect.
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "123.2026" } });
    expect(valueOf(h.input())).toBe("12.03.2026");
  });

  it("inserting a digit inside a complete date is rejected, not re-flowed (BH-035)", () => {
    const onChange = vi.fn();
    const onValidationError = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 2, 15),
      locale: "en",
      onChange,
      onValidationError,
    });
    fireEvent.change(h.input(), { target: { value: "115.03.2026" } });
    expect(valueOf(h.input()), "must not re-flow into 11.05.0320").toBe(
      "115.03.2026",
    );
    fireEvent.blur(h.input());
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith("impossible-date");
    expect(valueOf(h.input())).toBe("15.03.2026");
  });

  it("deleting a digit inside a date keeps the groups as typed (BH-035)", () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 2, 15),
      locale: "en",
      onChange,
    });
    fireEvent.change(h.input(), { target: { value: "1.03.2026" } });
    expect(valueOf(h.input()), "no padding under the caret").toBe("1.03.2026");
    fireEvent.change(h.input(), { target: { value: "17.03.2026" } });
    fireEvent.blur(h.input());
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-03-17");
  });

  it("deleting a separator is a no-op, never a different date (BH-035)", () => {
    const h = renderPicker({ initialValue: localDate(2026, 2, 15), locale: "en" });
    fireEvent.change(h.input(), { target: { value: "1503.2026" } });
    expect(valueOf(h.input())).toBe("15.03.2026");
  });

  it("Backspace over a trailing separator removes it", () => {
    // The no-op above is for a separator inside the date. At the end of the
    // text, deleting the separator is how a typist backs out of a group, and
    // keeping it made Backspace dead: "1." pads to "01." and could then never
    // be erased without selecting the text.
    const h = renderPicker({ locale: "en" });
    fireEvent.change(h.input(), { target: { value: "1." } });
    expect(valueOf(h.input())).toBe("01.");
    fireEvent.change(h.input(), { target: { value: "01" } });
    expect(valueOf(h.input()), "Backspace must remove the separator").toBe("01");
    fireEvent.change(h.input(), { target: { value: "0" } });
    expect(valueOf(h.input())).toBe("0");

    fireEvent.change(h.input(), { target: { value: "" } });
    fireEvent.change(h.input(), { target: { value: "15.03." } });
    expect(valueOf(h.input())).toBe("15.03.");
    fireEvent.change(h.input(), { target: { value: "15.03" } });
    expect(valueOf(h.input()), "Backspace must remove the separator").toBe("15.03");
    // Typing on from there continues the mask as usual.
    fireEvent.change(h.input(), { target: { value: "15.032" } });
    expect(valueOf(h.input())).toBe("15.03.2");
  });
});

describe("an edit the mask discards creates no draft (BH-065)", () => {
  it("a letter appended to a committed date does not rewrite the value", () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: new Date(2026, 6, 17, 23, 30),
      locale: "en",
      onChange,
    });
    fireEvent.change(h.input(), { target: { value: "17.07.2026x" } });
    expect(valueOf(h.input())).toBe("17.07.2026");
    fireEvent.blur(h.input());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("junk typed into an empty field does not report missing", () => {
    const onValidationError = vi.fn();
    const h = renderPicker({ locale: "en", onValidationError });
    fireEvent.change(h.input(), { target: { value: "abc" } });
    fireEvent.blur(h.input());
    expect(onValidationError).not.toHaveBeenCalled();
  });
});

describe("IME composition is not masked mid-composition (BH-071)", () => {
  it("keeps the provisional text and masks the confirmed result", () => {
    const h = renderPicker({ locale: "ja" });
    const input = h.input();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "に" } });
    expect(valueOf(input), "provisional IME text must stay").toBe("に");
    fireEvent.change(input, { target: { value: "１５" } });
    expect(valueOf(input)).toBe("１５");
    fireEvent.compositionEnd(input, { data: "１５" });
    expect(valueOf(input)).toBe("15");
  });

  it("Enter that confirms a candidate does not commit", () => {
    const onChange = vi.fn();
    const h = renderPicker({ locale: "ja", onChange });
    const input = h.input();
    fireEvent.change(input, { target: { value: "15072026" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("draft state follows the controlled value (BH-038, BH-053, BH-072)", () => {
  it("a parent value change drops the draft instead of re-committing it", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LocaleDatePicker
        value={localDate(2026, 5, 1)}
        onChange={onChange}
        placeholder="p"
        aria-label="Date"
      />,
    );
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "15122027" } });
    expect(valueOf(input)).toBe("15.12.2027");
    rerender(
      <LocaleDatePicker
        value={null}
        onChange={onChange}
        placeholder="p"
        aria-label="Date"
      />,
    );
    expect(valueOf(input)).toBe("");
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an open grid moves to a new value from the parent", () => {
    const { rerender } = render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Date"
        locale="en"
      />,
    );
    fireEvent.mouseDown(screen.getByRole("button", { hidden: true }));
    expect(screen.getByRole("grid", { name: /July 2026/ })).toBeTruthy();
    rerender(
      <LocaleDatePicker
        value={localDate(2026, 11, 25)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Date"
        locale="en"
      />,
    );
    const grid = screen.getByRole("grid", { name: /December 2026/ });
    const selected = grid.querySelector('[aria-selected="true"]');
    expect(selected?.textContent).toBe("25");
  });

  it("form.reset() drops the uncommitted draft", () => {
    function Form() {
      const [value, setValue] = React.useState<Date | null>(localDate(2026, 6, 17));
      return (
        <form data-testid="form">
          <LocaleDatePicker
            value={value}
            onChange={setValue}
            placeholder="p"
            aria-label="Date"
          />
        </form>
      );
    }
    render(<Form />);
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "18.07.2026" } });
    expect(valueOf(input)).toBe("18.07.2026");
    act(() => (screen.getByTestId("form") as HTMLFormElement).reset());
    expect(valueOf(input)).toBe("17.07.2026");
  });
});

describe("clearing and failing do not mislead the parent", () => {
  it("clearing a committed field restores it without reporting missing (BH-043)", () => {
    const onValidationError = vi.fn();
    const onBlur = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 6, 17),
      locale: "en",
      onValidationError,
      onBlur,
    });
    fireEvent.change(h.input(), { target: { value: "" } });
    fireEvent.blur(h.input());
    expect(onValidationError).not.toHaveBeenCalled();
    expect(valueOf(h.input())).toBe("17.07.2026");
    expect(isoLocal(onBlur.mock.calls[0][0])).toBe("2026-07-17");
  });

  it("a throwing predicate keeps the draft and still fires the parent blur (BH-066)", () => {
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener("error", swallow);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onBlur = vi.fn();
      const h = renderPicker({
        initialValue: localDate(2026, 6, 17),
        locale: "en",
        onBlur,
        shouldDisableDate: (d) => {
          if (d.getDate() === 18) throw new Error("boom");
          return false;
        },
      });
      fireEvent.change(h.input(), { target: { value: "18.07.2026" } });
      try {
        fireEvent.blur(h.input());
      } catch {
        /* React may rethrow; the assertions below are what matter */
      }
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(valueOf(h.input()), "the typed draft must survive").toBe("18.07.2026");
    } finally {
      window.removeEventListener("error", swallow);
      consoleError.mockRestore();
    }
  });
});

describe("disabled while a draft or the dialog is live (BH-039)", () => {
  it("drops a draft so Enter cannot commit it", () => {
    const onChange = vi.fn();
    const props = { onChange, placeholder: "p", "aria-label": "Date" };
    const { rerender } = render(
      <LocaleDatePicker value={localDate(2026, 6, 17)} {...props} />,
    );
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "18.07.2026" } });
    rerender(<LocaleDatePicker value={localDate(2026, 6, 17)} disabled {...props} />);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(valueOf(input)).toBe("17.07.2026");
  });

  it("closes an open dialog so its days cannot be picked", () => {
    const onChange = vi.fn();
    const props = {
      onChange,
      placeholder: "p",
      "aria-label": "Date",
      locale: "en",
    };
    const { rerender } = render(
      <LocaleDatePicker value={localDate(2026, 6, 17)} {...props} />,
    );
    fireEvent.mouseDown(screen.getByRole("button", { hidden: true }));
    const day = within(screen.getByRole("dialog")).getByRole("button", {
      name: /^20 /,
    });
    rerender(<LocaleDatePicker value={localDate(2026, 6, 17)} disabled {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(day);
    expect(onChange).not.toHaveBeenCalled();
  });
});
