# ResourceEditor

Edit FHIR resources as JSON or YAML with version history. Used by both generic resource editing (`/resource/:type/edit/:id`) and as a building block for ViewDefinition editing.

## Page Structure

The editor has tabs:
1. **Edit** - CodeMirror-based code editor with JSON/YAML toggle, format button, and copy functionality
2. **Versions** - Version history with diff viewer (only for existing resources)

Action buttons: **Save** and **Delete** (delete only for existing resources).

## Files

| File | Description |
|------|-------------|
| `page.tsx` | Main page component. `ResourceEditorPageWithLoader` handles data fetching, `ResourceEditorPage` renders the editor UI. |
| `editor-tab.tsx` | Code editor tab wrapping `CodeEditor` from react-components with menubar |
| `versions-tab.tsx` | Version history tab with diff viewing using `@git-diff-view/react` |
| `action.tsx` | Save and Delete button components with API calls |
| `api.ts` | API functions for fetching resources |
| `types.ts` | Type definitions (`EditorMode`, `ResourceEditorTab`, page ID) |

## Key Patterns

- Supports both JSON and YAML editing modes, switchable at runtime with automatic conversion
- `EditorTab` and `VersionsTab` are reused by the ViewDefinition page
- Resource text is kept in sync with parsed resource object — parsing errors are silently caught to allow intermediate invalid states
- Uses TanStack Query for data fetching with `retry: false`
- Save uses Aidbox client's `update` (for existing) or `create` (for new) operations
