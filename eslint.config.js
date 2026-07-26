import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "e2e/harness/dist/**",
      "playwright-report/**",
      "test-results/**",
      "*.tgz",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Dense intentional comments and unused-binding patterns from the
      // production port; tsc strict already enforces unused locals.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // The source component intentionally disables an exhaustive-deps line
  // with a comment explaining why; keep that freedom under lint.
  {
    files: ["src/LocaleDatePicker.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
