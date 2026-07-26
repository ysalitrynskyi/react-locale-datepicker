import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderPicker, localDate, isoLocal } from "./helpers";

describe("input masking and digit normalization", () => {
  it("typed digits mask into dd.MM.yyyy (iOS numeric keypad has no separators)", async () => {
    // Parity: typing is possible; digits auto-mask into the display format.
    const h = renderPicker({ initialValue: null });
    const input = h.input();
    await h.user.click(input);
    await h.user.keyboard("15032026");
    expect(
      input,
      "digits must auto-mask to dd.MM.yyyy — guards iOS keypad entry",
    ).toHaveValue("15.03.2026");
  });

  it("Eastern Arabic-Indic digits normalize to ASCII and parse", async () => {
    // Parity: Eastern Arabic-Indic digits are normalized to ASCII before parsing.
    const onChange = vi.fn();
    const h = renderPicker({ initialValue: null, onChange });
    const input = h.input();
    // Eastern Arabic-Indic: ٠١٢٣٤٥٦٧٨٩ — 15.03.2026
    fireEvent.change(input, { target: { value: "١٥٠٣٢٠٢٦" } });
    expect(
      input,
      "Eastern Arabic-Indic digits must normalize and mask to ASCII",
    ).toHaveValue("15.03.2026");
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalled();
    const committed: Date = onChange.mock.calls[0][0];
    expect(isoLocal(committed)).toBe("2026-03-15");
  });

  it("Extended Arabic-Indic digits (Persian range) also normalize", async () => {
    const h = renderPicker({ initialValue: null });
    const input = h.input();
    // Extended Arabic-Indic: ۰۱۲۳۴۵۶۷۸۹
    fireEvent.change(input, { target: { value: "۱۵۰۳۲۰۲۶" } });
    expect(input).toHaveValue("15.03.2026");
  });

  it("partial or malformed input does not commit a wrong date", async () => {
    // Parity: partial/malformed input must not commit a wrong date.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 0, 10),
      onChange,
    });
    const input = h.input();
    await h.user.clear(input);
    await h.user.keyboard("31.02.2026"); // impossible date
    await h.user.tab();
    // Invalid parse reverts; onChange must not receive 31 Feb or a rolled date.
    for (const call of onChange.mock.calls) {
      const d: Date = call[0];
      expect(
        d.getMonth() === 1 && d.getDate() === 31,
        "must not commit a rolled Feb 31",
      ).toBe(false);
    }
    // Display reverts to the previous committed value.
    expect(input).toHaveValue("10.01.2026");
  });

  it("incomplete draft on blur does not invent a date", async () => {
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 5, 1),
      onChange,
    });
    const input = h.input();
    await h.user.clear(input);
    await h.user.keyboard("15.03");
    await h.user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("01.06.2026");
  });

  it("mid-string editing re-masks from digits (classic masked-input path)", async () => {
    // Parity / TESTING: cursor position and mid-string editing behave.
    // The mask strips non-digits and re-applies separators — document that
    // contract so a future "smarter" mask cannot silently drop digits.
    const h = renderPicker({ initialValue: localDate(2026, 2, 15) });
    const input = h.input() as HTMLInputElement;
    await h.user.click(input);
    // Replace the whole value with a reordered digit stream.
    fireEvent.change(input, { target: { value: "15.03.2027" } });
    expect(input).toHaveValue("15.03.2027");
    // Insert extra separators / junk mid-string; only digits survive.
    fireEvent.change(input, { target: { value: "1a5b0c3d2e0f2g8" } });
    expect(
      input,
      "mask must keep only digits and re-apply dd.MM.yyyy separators",
    ).toHaveValue("15.03.2028");
  });

  it("paste of a dotted date is accepted and committed on blur", async () => {
    // TESTING: paste is handled.
    const onChange = vi.fn();
    const h = renderPicker({ initialValue: null, onChange });
    const input = h.input();
    await h.user.click(input);
    await h.user.paste("20.07.2026");
    expect(input).toHaveValue("20.07.2026");
    await h.user.tab();
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-20");
  });

  it("paste with slash separators parses on blur", async () => {
    const onChange = vi.fn();
    const h = renderPicker({ initialValue: null, onChange });
    const input = h.input();
    // parseTyped accepts . / - ; paste of slash form may arrive as raw text.
    fireEvent.change(input, { target: { value: "20/07/2026" } });
    // Masking strips non-digits then re-applies dots.
    expect(input).toHaveValue("20.07.2026");
    fireEvent.blur(input);
    expect(isoLocal(onChange.mock.calls[0][0])).toBe("2026-07-20");
  });

  it("typing never commits null when the field is cleared", async () => {
    // Source comment at commitTyped: typing never commits null.
    const onChange = vi.fn();
    const h = renderPicker({
      initialValue: localDate(2026, 3, 12),
      onChange,
    });
    const input = h.input();
    await h.user.clear(input);
    await h.user.tab();
    expect(
      onChange,
      "clearing by typing must not commit null — parent clears via value/onChange",
    ).not.toHaveBeenCalled();
    expect(input).toHaveValue("12.04.2026");
  });
});
