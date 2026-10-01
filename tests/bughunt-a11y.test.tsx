// Regression guards for the 2026-09-30 bug hunt: accessible names and ARIA.
// Each test names the ledger entry (docs/bug-hunts/2026-09-30.md) it closes.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { LocaleDatePicker } from "../src/LocaleDatePicker";
import { localDate } from "./helpers";

expect.extend(matchers);

const openTrigger = (scope: ParentNode = document) =>
  fireEvent.mouseDown(scope.querySelector('[data-part="trigger"]')!);

describe("the dialog always has a name (BH-056)", () => {
  it("is named by the month it shows when the field has no aria-label", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        locale="en"
      />,
    );
    openTrigger();
    expect(screen.getByRole("dialog", { name: "July 2026" })).toBeTruthy();
  });

  it("is named by the field's aria-label when there is one", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Start date"
        locale="en"
      />,
    );
    openTrigger();
    expect(screen.getByRole("dialog", { name: "Start date" })).toBeTruthy();
  });
});

describe("the open state lives on a role that allows it (BH-074)", () => {
  it("the whole open widget passes axe, not only the dialog", async () => {
    const { container } = render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Start date"
        locale="en"
      />,
    );
    openTrigger();
    const results = await axe(container, {
      // jsdom computes no colour; contrast is measured in e2e.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("the textbox has no aria-expanded; the trigger controls the dialog", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        aria-label="Start date"
      />,
    );
    const input = screen.getByRole("textbox");
    const trigger = document.querySelector('[data-part="trigger"]')!;
    expect(input).not.toHaveAttribute("aria-expanded");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    openTrigger();
    const dialog = screen.getByRole("dialog");
    expect(dialog.id).not.toBe("");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
    expect(input).toHaveAttribute("aria-controls", dialog.id);
  });
});

describe("labelling the field (BH-075)", () => {
  it("a wrapping label's name no longer absorbs the echo", () => {
    render(
      <label>
        Start date
        <LocaleDatePicker
          value={localDate(2026, 5, 17)}
          onChange={() => {}}
          placeholder="p"
          locale="en-GB"
        />
      </label>,
    );
    expect(screen.getByRole("textbox", { name: "Start date" })).toBeTruthy();
  });

  it("id lets <label htmlFor> name the input", () => {
    render(
      <>
        <label htmlFor="start">Start date</label>
        <LocaleDatePicker
          id="start"
          value={null}
          onChange={() => {}}
          placeholder="p"
        />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Start date" })).toBeTruthy();
  });

  it("aria-labelledby is forwarded to the input", () => {
    render(
      <>
        <span id="lbl">End date</span>
        <LocaleDatePicker
          aria-labelledby="lbl"
          value={null}
          onChange={() => {}}
          placeholder="p"
        />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "End date" })).toBeTruthy();
  });
});

describe("each trigger says which field it belongs to (BH-076)", () => {
  it("includes the field's aria-label", () => {
    render(
      <>
        <LocaleDatePicker
          value={null}
          onChange={() => {}}
          placeholder="p"
          aria-label="Start date"
          locale="en-GB"
        />
        <LocaleDatePicker
          value={localDate(2026, 6, 2)}
          onChange={() => {}}
          placeholder="p"
          aria-label="End date"
          locale="en-GB"
        />
      </>,
    );
    const [start, end] = Array.from(
      document.querySelectorAll('[data-part="trigger"]'),
    );
    expect(start).toHaveAttribute("aria-label", "Start date, Open calendar");
    // The date part is Intl's, and its en-GB pattern differs between ICU
    // releases: "Thursday 2 July 2026" in Node 20, "Thursday, 2 July 2026" in
    // Node 22. Built here the way the component builds it, rather than
    // pinning one CLDR release, so the whole name is still asserted.
    const date = new Intl.DateTimeFormat("en-GB", {
      calendar: "gregory",
      numberingSystem: "latn",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(localDate(2026, 6, 2));
    expect(date).toMatch(/Thursday.*2 July 2026/);
    expect(end.getAttribute("aria-label")).toBe(`End date, Change date, ${date}`);
  });
});

describe("an empty label override does not erase a name (BH-073)", () => {
  it("falls back to the Intl-derived navigation name", () => {
    render(
      <LocaleDatePicker
        value={localDate(2026, 6, 15)}
        onChange={() => {}}
        placeholder="p"
        locale="en"
        labels={{ previousMonth: "", nextMonth: "" }}
      />,
    );
    openTrigger();
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-part="nav-previous"]')).toHaveAttribute(
      "aria-label",
      "June 2026",
    );
    expect(dialog.querySelector('[data-part="nav-next"]')).toHaveAttribute(
      "aria-label",
      "August 2026",
    );
  });
});
