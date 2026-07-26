import { describe, expect, it, vi } from "vitest";
import { renderPicker, localDate, isoLocal } from "./helpers";

/**
 * ROADMAP Track 2 / Track 5: typed-input failure reporting. The contract
 * being protected is that the component NEVER decides validity — it
 * classifies and reports, the consumer renders. So every test here also
 * checks what did not happen: no commit, no change to hasError, no
 * second authority over selectability.
 */
describe("onValidationError", () => {
  it("reports an empty field as missing", async () => {
    const onValidationError = vi.fn();
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
      onChange,
    });
    await h.user.click(h.input());
    await h.user.paste("1");
    await h.user.clear(h.input());
    await h.user.tab();
    expect(onValidationError).toHaveBeenCalledWith("missing");
    expect(
      onChange,
      "typing never commits null — a parent that supports clearing does it from outside",
    ).not.toHaveBeenCalled();
  });

  it("reports a day that does not exist as impossible-date", async () => {
    const onValidationError = vi.fn();
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
      onChange,
    });
    await h.user.click(h.input());
    await h.user.paste("31022026"); // 31 February
    await h.user.tab();
    expect(onValidationError).toHaveBeenCalledWith("impossible-date");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports incomplete input as impossible-date", async () => {
    const onValidationError = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
    });
    await h.user.click(h.input());
    await h.user.paste("1707"); // no year
    await h.user.tab();
    expect(onValidationError).toHaveBeenCalledWith("impossible-date");
  });

  it("reports a real date the predicate rejects as not-selectable", async () => {
    const onValidationError = vi.fn();
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      shouldDisableDate: (d) => d.getDate() === 17,
      onValidationError,
      onChange,
    });
    await h.user.click(h.input());
    await h.user.paste("17072026");
    await h.user.tab();
    expect(
      onValidationError,
      "shouldDisableDate stays the single authority — a rejection is reported, not overridden",
    ).toHaveBeenCalledWith("not-selectable");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("fires on the Enter commit path too, not only on blur", async () => {
    const onValidationError = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
    });
    await h.user.click(h.input());
    await h.user.paste("31022026");
    await h.user.keyboard("{Enter}");
    expect(onValidationError).toHaveBeenCalledWith("impossible-date");
  });

  it("stays silent when a typed date is accepted", async () => {
    const onValidationError = vi.fn();
    const onChange = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
      onChange,
    });
    await h.user.click(h.input());
    await h.user.paste("17072026");
    await h.user.tab();
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-17");
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("stays silent when nothing was typed at all", async () => {
    // Focusing and leaving a field must not report a failure; there was no
    // typed entry to fail.
    const onValidationError = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 17),
      onValidationError,
    });
    await h.user.click(h.input());
    await h.user.tab();
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("never fires for a calendar click", async () => {
    const onValidationError = vi.fn();
    const h = renderPicker({
      locale: "en-US",
      initialValue: null,
      defaultCalendarMonth: localDate(2026, 6, 1),
      onValidationError,
    });
    await h.openViaClick();
    await h.clickDay(18);
    expect(
      onValidationError,
      "calendar clicks cannot produce an invalid date — reporting one would be noise",
    ).not.toHaveBeenCalled();
  });

  it("does not touch hasError, which stays consumer-controlled", async () => {
    // The whole point of the callback: the component reports, the consumer
    // decides whether that is an error worth showing.
    const onValidationError = vi.fn();
    const h = renderPicker({
      locale: "en",
      initialValue: null,
      onValidationError,
    });
    const field = () => h.container.querySelector('[data-part="field"]')!;
    expect(field().hasAttribute("data-error")).toBe(false);
    await h.user.click(h.input());
    await h.user.paste("31022026");
    await h.user.tab();
    expect(onValidationError).toHaveBeenCalled();
    expect(
      field().hasAttribute("data-error"),
      "the component must not decide validity — hasError is visual and consumer-owned",
    ).toBe(false);
  });

  it("still reverts the field to the committed value on a failure", async () => {
    // Pre-existing behaviour that the new reporting must not disturb.
    const h = renderPicker({
      locale: "en",
      initialValue: localDate(2026, 6, 17),
      onValidationError: vi.fn(),
    });
    await h.user.click(h.input());
    await h.user.clear(h.input());
    await h.user.paste("31022026");
    await h.user.tab();
    expect(
      (h.input() as HTMLInputElement).value,
      "invalid input must revert to the committed value",
    ).toBe("17.07.2026");
  });
});
