# ResourceBrowser

Browse, search, and inspect FHIR resources by type. Accessible at `/resource/:resourceType`.

## Page Structure

The page has three tabs:
1. **Resources** - Search and browse resources with a data table. Search input prepends `GET /fhir/{resourceType}?` and encodes the query as base64 in URL search params.
2. **Profiles** - View FHIR profiles/schemas for the resource type. Clicking a profile opens a resizable side panel showing differential/snapshot/FHIRSchema views.
3. **Search Parameters** - Display available search parameters from the CapabilityStatement (`/fhir/metadata`).

## Files

| File | Description |
|------|-------------|
| `page.tsx` | Main page component (`ResourcesPage`). Contains all tab content components, table rendering, and API calls. |
| `browser.tsx` | Resource browser table component |
| `types.tsx` | TypeScript interfaces (`ResourcesPageContext`, `ResourcesPageProps`, `ResourcesTabContentContext`, etc.) |
| `constants.tsx` | Page ID and default search query |

## Key Patterns

- Uses `ResourcesPageContext` and `ResourcesTabContentContext` React contexts for sharing resource type and loading state
- Fetches resource schemas via RPC endpoint `aidbox.introspector/get-schemas-by-resource-type`
- Resource table columns are dynamically generated from the resource keys present in the results
- Search query is stored as base64 in URL search params (`?searchQuery=...`)
- Resource values are humanized via `humanize.tsx` for display
- Uses `@health-samurai/react-components` DataTable for rendering
