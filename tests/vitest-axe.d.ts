// vitest-axe 0.1 augments the pre-1.0 `Vi` namespace, which Vitest 3 no
// longer reads, so its matcher is invisible to the type checker. Re-declare
// it on the module Vitest 3 actually uses.
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // T must match Vitest's own declaration for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
