# Aidbox UI

## Prerequisites

- Node.js 18+
- pnpm 10+
- Aidbox instance running locally

## Getting Started

```bash
git clone git@github.com:HealthSamurai/aidbox-ui.git
cd aidbox-ui
pnpm install
pnpm run dev
```

The app expects Aidbox running on `http://localhost:8765`. Configure via `VITE_AIDBOX_BASE_URL` environment variable if needed.

## Scripts

| Command               | Description                                          |
|-----------------------|------------------------------------------------------|
| `pnpm dev`            | Start development server                             |
| `pnpm build`          | Build for production                                 |
| `pnpm typecheck`      | Run TypeScript type checking                         |
| `pnpm lint`           | Run Biome linter                                     |
| `pnpm format`         | Format code with Biome                               |
| `pnpm all`            | Format, typecheck, and lint                          |
| `pnpm ts-sdk:init`    | Set up local aidbox-ts-sdk submodule for development |
| `pnpm ts-sdk:update`  | Pull latest changes and rebuild aidbox-ts-sdk        |


## Development Setup

1. Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) for formatting and linting support.
2. To work on `@health-samurai/react-components` locally, run `pnpm ts-sdk:init` once. This checks out the [aidbox-ts-sdk](https://github.com/HealthSamurai/aidbox-ts-sdk) submodule, builds it, and overrides the npm package with the local version. Run `pnpm ts-sdk:update` to pull and rebuild when the SDK changes.

