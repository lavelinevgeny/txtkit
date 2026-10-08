# AGENTS.md

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build  (typecheck is embedded in build)
npm run test         # vitest run
npm run test:watch   # vitest --watch
npm run lint         # eslint .
```

There is no separate `typecheck` script. Type checking runs as part of `build` via `tsc -b`.

## Verification order

`lint → test → build` (this is what the release scripts do).

## Architecture

Single-page React app. All processing is client-side, no backend.

- **Tool system**: Each tool in `src/tools/` exports a `ToolDescriptor` (defined in `src/types/tool.ts`). Tools are registered in `src/tools/registry.ts`. To add a tool: create the file, add it to the registry array.
- **State**: Zustand store at `src/store/useStore.ts`.
- **i18n**: Custom implementation in `src/i18n/` with locale JSONs in `src/i18n/locales/`. Supports `ru` and `en`.
- **Components**: `src/components/` — all UI is in this flat directory.
- **Tests**: `tests/` at repo root (not inside `src/`).

## TypeScript constraints

- `verbatimModuleSyntax` — use `import type` / `export type` for type-only imports.
- `erasableSyntaxOnly` — no TypeScript enums, no constructor parameter properties.
- `noUnusedLocals` + `noUnusedParameters` — all variables and parameters must be used.

## Testing

- Vitest with jsdom environment and globals enabled (no need to import `describe`/`it`/`expect`).
- Setup file: `src/test-setup.ts` (imports `@testing-library/jest-dom` matchers).
- Test files live in `tests/` and follow `<tool-name>.test.ts` naming.

## Release / Deploy

- `main` is protected by a ruleset: changes land only via PR with the required checks «Secret scan» and «Lint, test, build»; no direct pushes, force pushes or deletion.
- Releases go through `scripts/release.mjs` in two steps: `release:patch`/`minor`/`major` run the full pipeline, bump the version on a `release/vX.Y.Z` branch and open a PR; after it is merged, `release:tag` tags `main` and pushes the tag. Requires the `gh` CLI.
- There is no deploy automation in the repo: `dist/` is a static build that can be served by any web server.

## Language

Project docs and primary UI language is Russian. Keep this in mind when editing i18n strings or documentation.
