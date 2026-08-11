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
});
