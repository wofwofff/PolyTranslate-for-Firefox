import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "web-ext-artifacts/**"],
  },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-console": "off",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
