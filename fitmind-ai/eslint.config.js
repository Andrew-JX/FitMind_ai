import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.pnpm-store/**",
      "**/.vercel/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}", "client/vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // UI_SPEC §1.1 forbids hardcoded colors in components. Without a gate the
      // brand literals kept coming back with every UI batch, so this makes the
      // rule enforceable instead of aspirational. theme/tokens.ts is exempt
      // below, since that is where the value is allowed to live.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/#c8f035|rgba\\(\\s*200\\s*,\\s*240\\s*,\\s*53/i]",
          message:
            "Do not hardcode the brand color. Use BRAND_NEON / brandAlpha() for the theme-invariant neon, or accentAlpha(theme, a) when it should follow the theme.",
        },
        {
          selector:
            "TemplateElement[value.raw=/#c8f035|rgba\\(\\s*200\\s*,\\s*240\\s*,\\s*53/i]",
          message:
            "Do not hardcode the brand color. Use BRAND_NEON / brandAlpha() for the theme-invariant neon, or accentAlpha(theme, a) when it should follow the theme.",
        },
      ],
    },
  },
  {
    files: ["client/src/theme/tokens.ts", "client/src/theme/tokens.test.ts"],
    rules: {
      // The one place the brand color is defined, and the test that pins it —
      // both have to name the literal to do their job.
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["server/src/**/*.ts", "shared/src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["server/pgmigrate.config.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
