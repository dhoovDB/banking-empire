// ESLint flat config. Beyond the recommended set, this file turns the
// CLAUDE.md architecture contract into failing checks:
//
//   config/  →  engine/  →  renderer/  →  ui/
//
// Each layer may import only from layers to its left. BankingEmpire.jsx is
// the one exception — it owns React state and imports from all four layers.
// AI tools (Lovable, Claude Code) have historically collapsed these layers;
// a lint failure is cheaper than a review catch.

import js from "@eslint/js";
import globals from "globals";

// no-restricted-imports group builder: forbid reaching into these layers.
const forbid = (...layers) => ({
  patterns: layers.map(layer => ({
    group: [`**/${layer}/*`, `**/${layer}/**`],
    message: `Layer violation: this layer must not import from ${layer}/ (config → engine → renderer → ui, leftward only).`,
  })),
});

const forbidReact = {
  paths: [
    { name: "react",     message: "No React outside ui/ and BankingEmpire.jsx — engine and renderer stay framework-free." },
    { name: "react-dom", message: "No React outside ui/ and BankingEmpire.jsx — engine and renderer stay framework-free." },
  ],
};

export default [
  { ignores: ["dist/**", "node_modules/**"] },

  {
    ...js.configs.recommended,
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^React$" }],
    },
  },

  // config/ is data only: no project imports at all, no React.
  {
    files: ["config/**"],
    rules: {
      "no-restricted-imports": ["error", {
        ...forbid("config", "engine", "renderer", "ui"),
        paths: forbidReact.paths,
      }],
    },
  },

  // engine/ imports config only. Pure functions, no React, no canvas.
  {
    files: ["engine/**"],
    rules: {
      "no-restricted-imports": ["error", {
        ...forbid("renderer", "ui"),
        paths: forbidReact.paths,
      }],
    },
  },

  // renderer/ imports config + engine. Draws only, no React, no ui.
  {
    files: ["renderer/**"],
    rules: {
      "no-restricted-imports": ["error", {
        ...forbid("ui"),
        paths: forbidReact.paths,
      }],
    },
  },
];
