# rest/

Helper components for the REST Console page (main logic lives in `src/routes/rest.tsx`).

## Files

| File | Description |
|------|-------------|
| `active-tabs.tsx` | Tab bar component for managing multiple request tabs. Exports `Tab` type, `Header` type, `ResponseData` type, `DEFAULT_TAB`, and `ActiveTabs` component. |
| `collections.tsx` | Request collections (saved requests). Save/load requests to Aidbox's `ui_history` resource. |
| `left-menu.tsx` | Left sidebar with history and collections. `LeftMenuContext` for open/close state, `LeftMenuToggle` button. |
| `headers-editor.tsx` | HTTP headers key-value editor table |
| `params-editor.tsx` | Query parameters key-value editor table |

## Key Patterns

- Tab state is persisted in localStorage under key `aidbox-rest-console-tabs`
- Each tab stores: method, path, headers, params, body, response, active sub-tab
- Collections/history are stored in Aidbox as `ui_history` resources
- Headers and params editors use a pattern where there's always an empty row at the end for adding new entries
- The REST Console route (`rest.tsx`) is the main file — these components are extracted helpers
