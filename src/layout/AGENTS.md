# layout/

Application shell components rendered by the root route (`__root.tsx`).

## Files

| File | Description |
|------|-------------|
| `layout.tsx` | Main layout wrapper. Calls `useUserInfo()` on mount. Renders `Navbar` at top, `SidebarProvider` with `AidboxSidebar` + `SidebarInset` for content, and `Toaster` for notifications. Sidebar mode (expanded/collapsed) is persisted in localStorage. |
| `navbar.tsx` | Top navigation bar with breadcrumbs (auto-generated from route `staticData.title` and `loader` data) and user menu (logout button). |
| `sidebar.tsx` | Side navigation with links: Home, REST Console, Resource Browser (with resource type listing). Sidebar mode can be toggled between expanded, collapsed, and icon-only. |

## Key Patterns

- Layout fills the full viewport height (`h-screen`) with a flex column
- Sidebar state uses `useLocalStorage` with key `aidbox-sidebar-mode`
- Breadcrumbs are built from TanStack Router's `useMatches()` — each route can provide title via `staticData` or `loaderData.breadCrumb`
- Resource type list in sidebar is fetched from Aidbox's introspection API
