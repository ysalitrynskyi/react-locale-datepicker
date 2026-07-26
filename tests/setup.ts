import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement layout APIs the popup positioning effect uses.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op in jsdom */
  };
}

// getBoundingClientRect / offset* are 0 in jsdom; give the popup non-zero
// geometry so the position effect does not produce NaN-ish shift math.
const geometry = {
  x: 0,
  y: 0,
  top: 100,
  left: 20,
  bottom: 140,
  right: 300,
  width: 280,
  height: 40,
  toJSON() {
    return this;
  },
};
vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
  geometry as DOMRect,
);
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return 320;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return 312;
  },
});

// commit() installs a 350ms capture-phase click guard so a double-click on a
// day cannot hit whatever sits under the closed popup. Under jsdom that
// guard blocks the next test's day-cell clicks. Skip only that guard; the
// mousedown outside-close listener must keep working.
const realAddEventListener = document.addEventListener.bind(document);
document.addEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) => {
  if (type === "click" && options === true) {
    return;
  }
  return realAddEventListener(type, listener, options);
};

afterEach(async () => {
  cleanup();
  // Let the 350ms post-commit click guard timeout fire while jsdom is still
  // alive, so it does not throw after environment teardown in CI.
  await new Promise((r) => setTimeout(r, 360));
});
