import React from "react";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "vitest";
import {
  LocaleDatePicker,
  type LocaleDatePickerProps,
} from "../src/LocaleDatePicker";

/** Local-midnight Date from calendar parts — never UTC-parsed. */
export function localDate(y: number, m0: number, d: number): Date {
  return new Date(y, m0, d);
}

export function isoLocal(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type HarnessProps = Partial<LocaleDatePickerProps> & {
  /** Initial controlled value; updates via onChange. */
  initialValue?: Date | null;
};

/**
 * Controlled harness. Exposes the latest committed value via a test id so
 * assertions do not depend on parent-state closure timing.
 */
export function renderPicker(props: HarnessProps = {}) {
  const {
    initialValue = null,
    onChange,
    onBlur,
    onDisabledOpenAttempt,
    ...rest
  } = props;

  const changeSpy = onChange ?? (() => undefined);
  const blurSpy = onBlur;
  const disabledSpy = onDisabledOpenAttempt;

  function Harness() {
    const [value, setValue] = React.useState<Date | null>(initialValue ?? null);
    return (
      <>
        <LocaleDatePicker
          value={value}
          onChange={(d) => {
            setValue(d);
            changeSpy(d);
          }}
          placeholder={rest.placeholder ?? "dd.mm.yyyy"}
          onBlur={(current) => {
            blurSpy?.(current);
          }}
          onDisabledOpenAttempt={disabledSpy}
          {...rest}
        />
        <pre data-testid="committed-iso">{isoLocal(value) ?? ""}</pre>
      </>
    );
  }

  const user = userEvent.setup();
  const view = render(<Harness />);
  const input = () => screen.getByRole("textbox");
  const committed = () => screen.getByTestId("committed-iso").textContent ?? "";

  const dayButton = (dayOfMonth: number) => {
    const dialog = screen.getByRole("dialog");
    const buttons = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("data-day"));
    const match = buttons.find(
      (b) => b.textContent?.trim() === String(dayOfMonth),
    );
    if (!match) {
      throw new Error(`No day cell for ${dayOfMonth} in the open grid`);
    }
    return match;
  };

  return {
    user,
    ...view,
    input,
    committed,
    openViaClick: async () => {
      // Icon button uses mousedown-toggle; more reliable under jsdom than
      // the input onClick path when focus/blur races.
      const icon = screen.getByRole("button", { hidden: true });
      fireEvent.mouseDown(icon);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeTruthy();
      });
    },
    openViaKeyboard: async () => {
      input().focus();
      await user.keyboard("{ArrowDown}");
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeTruthy();
      });
    },
    dialog: () => screen.getByRole("dialog"),
    queryDialog: () => screen.queryByRole("dialog"),
    dayButtons: () => {
      const dialog = screen.getByRole("dialog");
      return within(dialog)
        .getAllByRole("button")
        .filter((b) => b.hasAttribute("data-day"));
    },
    dayButton,
    clickDay: async (dayOfMonth: number) => {
      // fireEvent.click avoids user-event pointer quirks against the popup's
      // mousedown preventDefault (keeps focus in the input while open).
      fireEvent.click(dayButton(dayOfMonth));
    },
    headerPrev: () => {
      const dialog = screen.getByRole("dialog");
      // First non-day, non-pill control in the header is previous-month/year.
      const buttons = Array.from(dialog.querySelectorAll("button")).filter(
        (b) =>
          !b.hasAttribute("data-day") &&
          b.getAttribute("aria-expanded") === null &&
          b.getAttribute("aria-label"),
      );
      return buttons[0] as HTMLButtonElement;
    },
    headerNext: () => {
      const dialog = screen.getByRole("dialog");
      const buttons = Array.from(dialog.querySelectorAll("button")).filter(
        (b) =>
          !b.hasAttribute("data-day") &&
          b.getAttribute("aria-expanded") === null &&
          b.getAttribute("aria-label"),
      );
      return buttons[buttons.length - 1] as HTMLButtonElement;
    },
  };
}
