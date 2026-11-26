# PlanDefinition

Package editor: an SDC PlanDefinition that bundles forms, with rules (conditions) and prefills between them. Opened from the Forms grid at `/forms/packages/$packageId` and `/forms/packages/new` (`src/routes/forms.packages.tsx`).

| File | Description |
|------|-------------|
| `plan-definition-editor.tsx` | Page and editor shell: load, draft, save, unsaved-changes guard |
| `plan-definition-draft.ts`, `plan-definition-model.ts` | Draft state and the PlanDefinition ⇄ editor model mapping |
| `plan-definition-graph*.ts(x)` | Graph view of forms and rules on React Flow: layout, custom nodes and rule edges, drag reorder, edge legend |
| `plan-definition-rule*.ts`, `plan-definition-condition*.tsx`, `plan-definition-conditions.ts`, `plan-definition-expressions.ts` | Rules and their FHIRPath conditions |
| `plan-definition-prefill*.ts(x)` | Prefill rules between forms |
| `plan-definition-properties.tsx`, `plan-definition-fields.tsx` | Package properties panel and inline field errors |
| `plan-definition-add-questionnaires-dialog.tsx`, `plan-definition-questionnaires.ts`, `plan-definition-question-select.tsx` | Forms of the package |
| `plan-definition-preview.tsx`, `plan-definition-quick-look.tsx` | Preview of the package, also used by the Forms grid preview |
| `plan-definition-code.ts` | Validation of the PlanDefinition JSON |
| `plan-definition-save-dialog.tsx` | Save confirmation, offers a new resource when the canonical changes |
| `navbar-slot.tsx` | Breadcrumb label and actions of the editor in the app navbar |

Requests live in `../Forms/api/plan-definitions.ts`; the code and FHIRPath editors in `../Forms/editor/`.
