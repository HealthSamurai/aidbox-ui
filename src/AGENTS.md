# src/

Application source root.

## Entry Point

`index.tsx` bootstraps the app:
1. Creates TanStack Router with `basepath: "/u"`
2. Creates TanStack QueryClient
3. Renders provider tree: `StrictMode > QueryClientProvider > AidboxClientProvider > RouterProvider`

## AidboxClient.tsx

Provides the Aidbox REST client via React context. Key exports:
- `AidboxClientProvider` - Wraps app with `AidboxClient` using `BrowserAuthProvider`
- `useAidboxClient()` - Hook to access the client instance
- `AidboxClientR5` - TypeScript type for the client (parameterized with R5 Bundle/OperationOutcome)

## Key Files

- `humanize.tsx` - Utilities for rendering FHIR resource values in human-readable format
- `utils.ts` - General utilities (search query formatting, HTTP request parsing, snapshot tree transformation)
- `type-utils.ts` - TypeScript utility types
- `index.css` - Global styles (Tailwind imports)
- `routeTree.gen.ts` - Auto-generated route tree (do not edit manually)
