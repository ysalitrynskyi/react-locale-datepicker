/**
 * @vitest-environment node
 *
 * Consumer contract: the module must be importable and renderable with no
 * `window` / `document` present (Astro / RSC / any SSR host). A module-scope
 * window access would crash the server render of a checkout form island.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("consumer contract: SSR-safe", () => {
  it("imports without window/document and renders to string", async () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    const mod = await import("../src/LocaleDatePicker");
    expect(typeof mod.LocaleDatePicker).toBe("function");
    expect(typeof mod.resolveLocale).toBe("function");
    expect(mod.resolveLocale("ua")).toBe("uk");

    const html = renderToString(
      React.createElement(mod.LocaleDatePicker, {
        value: null,
        onChange: () => undefined,
        locale: "ua",
        placeholder: "dd.mm.yyyy",
        "aria-label": "Travel start",
      }),
    );

    expect(html).toContain("rldp-root");
    expect(html).toContain("rldp-input");
    // Popover is closed on first paint — must not assume document for portal.
    expect(html).not.toContain('role="dialog"');
  });

  it("renders with portal enabled and no document present", async () => {
    // `portal: true` resolves `document.body` during render. That is guarded,
    // but the guard was only ever asserted in a comment — the SSR test above
    // exercises the DEFAULT path, so a regression in the portal branch would
    // have shipped green and crashed the server render of any consumer who
    // opted in. Consumers opt in precisely because their form card clips, i.e.
    // this is the path a checkout is most likely to use.
    const mod = await import("../src/LocaleDatePicker");

    for (const portal of [true, false, undefined]) {
      const html = renderToString(
        React.createElement(mod.LocaleDatePicker, {
          value: new Date(2026, 7, 12),
          onChange: () => undefined,
          locale: "ua",
          placeholder: "dd.mm.yyyy",
          portal,
        }),
      );
      expect(html).toContain("rldp-root");
      // Closed on first paint regardless of portal, so nothing is portaled yet.
      expect(html).not.toContain('role="dialog"');
    }
  });

  it("does not treat a non-element portal value as a host", async () => {
    // A truthy non-element (a ref object passed by mistake, a stale null-ish
    // value from a consumer's own state) must degrade to in-tree rather than
    // throw inside createPortal on the server.
    const mod = await import("../src/LocaleDatePicker");
    for (const portal of [{} as never, { current: null } as never, 0 as never]) {
      expect(() =>
        renderToString(
          React.createElement(mod.LocaleDatePicker, {
            value: null,
            onChange: () => undefined,
            locale: "en",
            placeholder: "dd.mm.yyyy",
            portal,
          }),
        ),
      ).not.toThrow();
    }
  });
});
