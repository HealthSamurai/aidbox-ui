# Forms

The Forms section: SDC forms (Questionnaire), packages (PlanDefinition), responses (QuestionnaireResponse) and Liquid templates. Routes live in `src/routes/forms.*.tsx`; every tab page sits under `FormsTabs`.

| Route | Page |
|-------|------|
| `/forms` | `page.tsx` — forms and packages grid |
| `/forms/responses` | `responses/page.tsx` |
| `/forms/templates` | `templates/page.tsx` |
| `/forms/packages/$packageId`, `/forms/packages/new` | `../PlanDefinition/plan-definition-editor.tsx` |

The form builder, the Liquid template editor and the response renderer are not here: they stay in the classic UI (`/ui/sdc`), and the links to them are built in `utils.ts`.

## Layout

| Path | Contents |
|------|----------|
| `page.tsx`, `forms-*.tsx`, `form-actions.tsx`, `search.ts` | Forms grid: table, toolbar, filters, row actions, URL search params |
| `forms-tabs.tsx` | Section tabs (Forms, Responses, Templates) |
| `grid-filters.tsx`, `format.ts` | Filter controls and date formatting shared by the three grids |
| `delete-form-dialog.tsx`, `form-preview-dialog.tsx`, `preview-dialog.tsx`, `form-dialog-fields.tsx` | Row dialogs and their shared fields |
| `renderer.tsx` | Form renderer used by previews |
| `classic-ui-tab.tsx` | Links into the classic UI, also used by ResourceEditor |
| `utils.ts` | Classic UI URLs, labels, canonical helpers |
| `api/` | Requests shared across the section: `forms-list.ts` (the `Form` view, grid search, pins, filter options), `forms.ts` (one Questionnaire: read, duplicate, delete), `plan-definitions.ts` (packages, `searchResources`, `sdcRequest`), `templates.ts`, `configurations.ts` (SDCConfig and QuestionnaireTheme options), `resource-error.ts` (request errors: `resourceOf`, `rejectWith`, `ResourceRequestError`), `const.ts` |
| `share/` | Send, Share and Generate link dialogs, recipient search; `api.ts` sends and links, `sharing.ts` the OrgBAC share mode |
| `import/` | Import dialog: JSON, openEHR, PDF and AI import, AI provider settings; `api.ts` validation and import requests |
| `editor/` | Code editors for Questionnaire and PlanDefinition JSON, FHIRPath editor, editor shortcuts |
| `responses/` | Responses grid, filters, delivery status, PDF export; `api.ts` search, package grouping, cancel sending, delete |
| `templates/` | Liquid templates grid and bulk delete |

## Conventions

- A request used by one feature lives in that feature's `api.ts`; `api/` holds only what several features share.

- Grids use `components/data-table` with opt-in props only; do not change its defaults for the whole app.
- Box requests go through `useAidboxClient`: `client.request<T>` wrapped in `resourceOf` for JSON, `client.rawRequest(...).catch(rejectWith(...))` for non-JSON or empty answers (`api/resource-error.ts`), so a failure becomes a `ResourceRequestError` with the server's OperationOutcome.
- Generic pieces shared with other SDC editors live outside: `components/app-select.tsx`, `components/unsaved-changes.tsx`, `components/save-diagnostics.tsx`, `utils/scroll.ts`.
