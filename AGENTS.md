# Aidbox UI

Admin UI for [Aidbox](https://docs.aidbox.app/) FHIR server. Built with React 19, TypeScript, TanStack Router (file-based routing), TanStack Query, and Tailwind CSS 4.

## Tech Stack

- **React 19** with React Compiler (babel-plugin-react-compiler)
- **TypeScript 5.9** (strict mode)
- **Vite 7** (build tool, dev server)
- **TanStack Router** (file-based routing with auto code splitting)
- **TanStack Query** (server state management)
- **Tailwind CSS 4** (utility-first CSS)
- **CodeMirror 6** (code editors)
- **Biome 2** (linter + formatter, replaces ESLint/Prettier)
- **pnpm 10** (package manager)

## UI Component Library

Uses `@health-samurai/react-components` - a custom component library providing Tabs, DataTable, ResizablePanel, CodeEditor, Button, Input, AlertDialog, Sidebar, Toaster, and more.

## Key Conventions

- **Import alias**: `@aidbox-ui` maps to `/src`
- **Base path**: All routes are served under `/u` (UI_BASE_PATH)
- **Aidbox connection**: Default `http://localhost:8765`, configurable via `VITE_AIDBOX_BASE_URL`
- **Indent style**: Tabs (configured in biome.json)
- **Quote style**: Double quotes
- **Namespace imports**: Common pattern is `import * as Foo from "..."` for grouping related imports
- **No tests**: Test infrastructure is not set up yet

## Scripts

- `pnpm dev` - Start dev server
- `pnpm build` - Production build
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` / `pnpm lint:fix` - Biome linting
- `pnpm format` - Biome formatting
- `pnpm all` - Format + typecheck + lint (pre-commit)
- `pnpm generate-types` - Generate FHIR type definitions

## Architecture

```
src/
  index.tsx            # Entry point: React root, providers (QueryClient, AidboxClient, Router)
  AidboxClient.tsx     # Aidbox REST client context/provider
  routes/              # TanStack Router file-based routes
  components/          # Feature components (ResourceBrowser, ResourceEditor, ViewDefinition, rest)
  layout/              # App shell (Layout, Navbar, Sidebar)
  hooks/               # Custom React hooks (useLocalStorage, useDebounce, useWindowEvent)
  api/                 # Auth utilities (useUserInfo, useLogout, useUIHistory)
  shared/              # Constants (UI_BASE_PATH, HTTP_STATUS_CODES) and shared types
  utils/               # Utility functions (diff, tree-walker, etc.)
  fhir-types/          # Generated FHIR R5 type definitions
```

## Features

| Feature | Route | Description |
|---------|-------|-------------|
| Resource Browser | `/resource/{type}` | Browse, search, view FHIR resources with profiles and search parameters |
| Resource Editor | `/resource/{type}/edit/{id}` | Edit FHIR resources (JSON/YAML) with version history |
| ViewDefinition Builder | `/resource/ViewDefinition/...` | Create/edit SQL-on-FHIR ViewDefinitions with form editor, code editor, SQL preview |
| REST Console | `/rest` | Interactive HTTP client for Aidbox REST API with tabs, history, collections |
