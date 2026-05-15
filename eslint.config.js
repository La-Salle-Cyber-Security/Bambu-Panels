// eslint.config.js
// Flat config format (ESLint v9+)

import js from "@eslint/js";
import globals from "globals";

export default [
  // ── Ignore generated / non-source files ──────────────────────────────────
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "pkgroot/**",
      "bundle/**",
    ],
  },

  // ── Node.js source files (server-side ESM) ───────────────────────────────
  {
    files: ["server.js", "sniff.js", "test.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // Catch real bugs
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^(setLight|morseStart|morseStop)$" }],
      "no-unreachable": "error",

      // Async safety
      "no-async-promise-executor": "error",
      "require-atomic-updates": "warn",

      // Style (warn only — non-blocking)
      "no-var": "warn",
      "prefer-const": "warn",
      "eqeqeq": ["warn", "always", { null: "ignore" }],
    },
  },

  // ── Browser-side JS (public/) ─────────────────────────────────────────────
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",   // public/app.js uses plain script, not ESM
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
