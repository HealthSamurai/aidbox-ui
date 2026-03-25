# Contributing to Aidbox UI

This guide covers the development setup, workflow, and conventions for contributing to the project.

## Prerequisites

- **Node.js 18+**
- **[pnpm](https://pnpm.io/installation) 10+**
- **Aidbox instance** running locally (default `http://localhost:8765`)

## Setup

```bash
git clone --recursive git@github.com:HealthSamurai/aidbox-ui.git
cd aidbox-ui
pnpm install   # preinstall auto-builds the react-components submodule
pnpm hooks     # install pre-commit hooks
pnpm dev       # start dev server
```

If you make changes to `@health-samurai/react-components`, run `pnpm rc:build` and restart the dev server for the changes to take effect (Vite caches pre-bundled deps in memory).

Configure `VITE_AIDBOX_BASE_URL` if your Aidbox runs on a different address.

## Development workflow

1. **Create a branch** from `master`:
   ```bash
   git checkout -b my-feature master
   ```

2. **Make your changes.**
   Useful commands while developing:
   ```bash
   pnpm dev          # start Vite dev server
   pnpm typecheck    # type-check the project
   pnpm lint:fix     # auto-fix linting and formatting
   pnpm all          # format + typecheck + lint (one shot)
   pnpm rc:build     # rebuild react-components submodule + clear Vite cache
   ```

3. **Commit.**
   The pre-commit hook runs `pnpm lint:check` and `pnpm typecheck`.
   Fix any issues before pushing.

4. **Open a pull request** against `master`.

## Working with react-components (submodule)

The `@health-samurai/react-components` package lives in the `aidbox-ts-sdk` git submodule (linked via `file:` protocol in `package.json`). Source code is at `aidbox-ts-sdk/packages/react-components/src/`.

After making changes in the submodule:

```bash
pnpm rc:build   # builds react-components + reinstalls + clears Vite cache
# then restart dev server (Ctrl+C, pnpm dev)
```

Restart is required because Vite caches pre-bundled deps in memory.

**Committing submodule changes:**

1. Commit and push inside `aidbox-ts-sdk/` (target the `development` branch)
2. Then commit the updated submodule ref in `aidbox-ui`

## Code style

All formatting and linting is handled by [Biome](https://biomejs.dev/).
There is no ESLint or Prettier.

- Indentation: **tabs**
- Quotes: **double quotes**
- Imports: auto-organized alphabetically by Biome

Run `pnpm lint:fix` to auto-format.
The pre-commit hook enforces formatting automatically.

## Project structure

```
src/
  routes/          # TanStack Router file-based routes
  components/      # Feature-scoped UI components
  layout/          # App shell (navbar, sidebar)
  api/             # API layer and schemas
  hooks/           # Shared React hooks
  shared/          # Constants, types, shared utilities
  utils/           # Pure utility functions
  fhir-types/      # Generated FHIR type definitions
scripts/           # Code generation scripts
aidbox-ts-sdk/     # Git submodule (react-components, aidbox-client, fhirpath-lsp)
```

## Tech stack

- **React 19** with React Compiler
- **TanStack Router** — file-based routing with auto code splitting
- **TanStack Query** — server state management
- **Tailwind CSS v4** — styling via design tokens from react-components
- **Vite** — bundler and dev server
- **Biome** — linting and formatting
- **TypeScript** in strict mode

## Guidelines

- **Use `@health-samurai/react-components`** for all UI.
  Do not install third-party UI libraries (shadcn/ui, MUI, Ant Design, etc.).
- **Use design tokens** (`text-text-primary`, `bg-bg-secondary`, `border-border-primary`) instead of raw Tailwind color values.
- **Icons:** use `lucide-react` for standard icons. Use icons from `@health-samurai/react-components` only for domain-specific FHIR icons.
- **TypeScript strict mode** is enforced.
  Do not use `any` — prefer `unknown`, generics, or proper types.
- **Do not edit `src/fhir-types/`** — these types are generated via `pnpm generate-types`.
- **Path alias:** use `@aidbox-ui/*` to import from `src/*` (configured in `tsconfig.app.json`).
- **Keep PRs focused.**
  One feature or fix per PR.
  Avoid unrelated refactors.

## Reporting bugs

Open an issue at [github.com/HealthSamurai/aidbox-ui/issues](https://github.com/HealthSamurai/aidbox-ui/issues) with:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and Aidbox version

## Questions

For any questions or clarifications, open a discussion or issue on the repository.
