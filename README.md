# Vibemaxxer

Vibemaxxer is a web-based game which basically is a satire of vibe coding. Refer
to `docs/` for detailed writeups of the game.

`docs/` is a directory for developer-supplied notetakings. This repository won't be facing public. So don't try to polish the notes there.
Also, don't add/modify/remove contents under `docs/` without any explict developer's order. The coding agent's job is to implement based on the docs, not to update the docs. It's one-way.

Don't try to create a fullly functional product in one shot. This is not the
developer want. Instead, implement the game stages and features piecewise and
make the developer try out each(so it have a cheat-like feature in developer
mode to try out something in the middle of the entire game storybook).

This repository is based on a create-vite-app template with Bun. The below is
the originally generated README.

REMINDER: NEVER ADD PLACEHOLDER DESCRIPTIONS ON NEWLY ADDED UI COMPONENTS. LESS
TEXT AND CONSISE DESIGN IS ALWAYS BEST. THIS IS A GAME, NOT A DASHBOARD. DO NOT
ANNOTATE UNWANTED IMPLEMENTATION DETAIL(ex: specific probability value of specific
action) ON UI VOLUNTARILY.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
