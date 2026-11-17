# CLAUDE.md

## UI Components

All UI must be built using components from `@health-samurai/react-components`. Do not install or use third-party UI libraries (shadcn/ui, Radix primitives directly, MUI, Ant Design, etc.) — everything needed is already available in the component library.

Before building any UI, invoke the `/ui` skill to look up available components, their props, variants, and design tokens. The skill provides the full reference for the Aidbox design system.

Import pattern used in the project:
```tsx
import * as HSComp from "@health-samurai/react-components";
// or destructured:
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@health-samurai/react-components";
```

Use semantic design token classes (`text-text-primary`, `bg-bg-secondary`, `border-border-primary`) instead of raw Tailwind color values.

Icons: use `lucide-react` for standard icons. Use icons from `@health-samurai/react-components` only for domain-specific FHIR icons (PlayIcon, ResourceIcon, etc.).

## Figma

When a Figma link is provided, invoke the `/figma-use` skill to inspect the design before implementing UI.

### Setup (fresh clone)

```bash
git clone git@github.com:HealthSamurai/aidbox-ui.git
cd aidbox-ui
pnpm install
pnpm dev
```

## Linting & Type Checking

Always run `pnpm lint:fix` and `pnpm typecheck` after making code changes.

**Never suppress biome errors with `biome-ignore`.** If a lint rule triggers, refactor the code to fix the underlying issue (e.g., extract a function to reduce complexity, restructure to avoid the pattern). The lint rules exist to keep the codebase maintainable.
