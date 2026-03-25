# Security Policy

## Supported versions

Only the latest version of Aidbox UI (the `master` branch) is actively maintained and receives security fixes.

## Reporting a vulnerability

If you discover a security vulnerability in this project, **please report it privately**.
Do not open a public issue.

**Email:** [security@health-samurai.io](mailto:security@health-samurai.io)

Include as much of the following as you can:

- Description of the vulnerability
- Steps to reproduce or a proof of concept
- Potential impact
- Browser and Aidbox version, if relevant

We will acknowledge your report within **3 business days** and aim to provide a fix or mitigation plan within **14 days**, depending on severity.

## Security measures

### Code quality

- **TypeScript strict mode** with `noUncheckedIndexedAccess` — catches a broad class of type-safety issues at compile time.
- **Biome** linting and formatting with recommended rules enforced across the project.
- **React Compiler** enabled — prevents common React anti-patterns that can lead to stale data or unexpected re-renders.

### Pre-commit hooks

The pre-commit hook (installed via `pnpm hooks`) runs:
- `pnpm lint:check` — Biome linting
- `pnpm typecheck` — full TypeScript type check

### CI pipeline

Every push triggers four parallel jobs:
1. **Lint** — `pnpm lint:check`
2. **Typecheck** — `pnpm typecheck`
3. **Audit** — `pnpm audit --audit-level=high` (fails on high-severity vulnerabilities)
4. **Build** — production build to catch bundler-level issues

All CI jobs use `--frozen-lockfile` for reproducible builds.

### Dependency management

- **Dependabot security alerts** automatically open PRs when a CVE is published for a dependency. Routine version bumps without security fixes are not included.
- **GitHub Actions** updates are tracked weekly via Dependabot version updates.
- **pnpm lockfile** provides integrity hashes for all installed packages.

### Secrets

- `.env` and `.env.*` files are excluded from version control via `.gitignore`.
- No secrets are hardcoded in the source.

## Scope

This policy covers the Aidbox UI application and its first-party source code.
For vulnerabilities in `@health-samurai` packages (aidbox-client, react-components, aidbox-fhirpath-lsp), report to the [aidbox-ts-sdk](https://github.com/HealthSamurai/aidbox-ts-sdk/blob/development/SECURITY.md) repository instead.

## Disclosure

We follow coordinated disclosure.
Once a fix is released, we will credit reporters (unless they prefer anonymity) and publish an advisory if warranted.
