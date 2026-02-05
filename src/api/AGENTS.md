# api/

API utilities and auth hooks.

## Files

| File | Description |
|------|-------------|
| `auth.ts` | Authentication hooks: `useUserInfo()` fetches current user info, `useLogout()` handles logout with redirect to Aidbox login page, `useUIHistory()` fetches REST Console history entries. |
| `utils.tsx` | API helper functions for parsing `OperationOutcome` responses into readable error messages. |

## Key Patterns

- All hooks use TanStack Query (`useQuery` / `useMutation`)
- `useUserInfo()` is called in the root Layout component on every page load
- Logout redirects to `{aidboxBaseUrl}/auth/login?redirect_to={encodedCurrentUrl}`
- UI history is stored as `ui_history` resources in Aidbox, fetched sorted by `_lastUpdated`
