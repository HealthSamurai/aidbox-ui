# components/

Feature-level components organized by domain. Each subdirectory is a self-contained feature area.

## Structure

| Directory | Feature | Description |
|-----------|---------|-------------|
| `ResourceBrowser/` | Resource Browser | Browse and search FHIR resources, view profiles and search parameters |
| `ResourceEditor/` | Resource Editor | Edit FHIR resources as JSON/YAML with version history |
| `ViewDefinition/` | ViewDefinition Builder | SQL-on-FHIR ViewDefinition editor with form/code/SQL tabs |
| `rest/` | REST Console helpers | Tab management, header/param editors, collections for REST Console |

## Shared Component

- `Split.tsx` - Resizable panel split button component (horizontal/vertical toggle)

## Conventions

- `page.tsx` is typically the main page component exported for route consumption
- `types.tsx` / `types.ts` contains TypeScript interfaces and type definitions
- `constants.tsx` / `constants.ts` holds page-specific constants (IDs, defaults)
- Components use `@health-samurai/react-components` for UI primitives
- State management via React Context for feature-scoped state, TanStack Query for server state
