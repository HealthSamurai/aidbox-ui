<p align="center">
  <img src=".github/logo.svg" width="64" height="64" alt="Health Samurai">
</p>

<h1 align="center">Aidbox UI</h1>

<p align="center">
  The administration console for <a href="https://www.health-samurai.io/aidbox">Aidbox</a> — a FHIR-first platform for healthcare application development.
</p>

<p align="center">
  <a href="https://github.com/HealthSamurai/aidbox-ui/actions/workflows/ci.yaml"><img src="https://github.com/HealthSamurai/aidbox-ui/actions/workflows/ci.yaml/badge.svg" alt="CI"></a>
</p>

## Getting started

```bash
# requires pnpm 10+ and Node.js 18+
git clone git@github.com:HealthSamurai/aidbox-ui.git
cd aidbox-ui
git submodule update --init --recursive
pnpm install   # preinstall auto-builds the react-components submodule
pnpm rc:build  # rebuild react-components + clear Vite cache
pnpm dev
```

The app expects Aidbox running on `http://localhost:8765`.
Configure via `VITE_AIDBOX_BASE_URL` environment variable if needed.

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | Type-check the project |
| `pnpm lint:fix` | Lint and auto-fix with Biome |
| `pnpm all` | Format + typecheck + lint |
| `pnpm hooks` | Install git pre-commit hooks |
| `pnpm rc:build` | Rebuild react-components submodule + clear Vite cache |

## Tech stack

- **React 19** with React Compiler
- **TanStack Router** — file-based routing with auto code splitting
- **TanStack Query** — server state management
- **Tailwind CSS 4** — styling via design tokens from react-components
- **Vite** — bundler and dev server
- **Biome** — linting and formatting
- **TypeScript** in strict mode

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and code style details.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

[MIT](LICENSE)
