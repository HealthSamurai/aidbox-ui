# ViewDefinition

SQL-on-FHIR ViewDefinition editor. The most complex feature in the app. Accessible at `/resource/ViewDefinition/create` and `/resource/ViewDefinition/edit/:id`.

## Page Structure

Three top-level page tabs (managed via URL search param `?pageTab=`):
1. **ViewDefinition Builder** - Main builder with editor and result panels
2. **Edit** - Raw JSON/YAML editor (reuses `EditorTab` from ResourceEditor)
3. **Versions** - Version history (reuses `VersionsTab` from ResourceEditor, only for existing resources)

The Builder tab has a resizable two-panel layout:
- **Editor Panel** (left) - Form editor, Code editor, or SQL preview
- **Result Panel** (right) - Run results, FHIR schema browser, example data, info panel

## State Management

Two React contexts provide shared state:
- `ViewDefinitionContext` - Main state: `viewDefinition`, `runResult`, pagination, dirty tracking
- `ViewDefinitionResourceTypeContext` - Selected FHIR resource type for the ViewDefinition

Unsaved changes are tracked via `isDirty` flag with `useBlocker` for navigation protection.

## Files

| File | Description |
|------|-------------|
| `page.tsx` | Main page component, context providers, page-level tabs, data fetching |
| `types.tsx` | All TypeScript types and interfaces (contexts, tab types, Snapshot, Meta) |
| `constants.tsx` | Page ID and configuration constants |
| `editor-panel-content.tsx` | Builder's left panel with form/code/SQL tabs |
| `editor-form-tab-content.tsx` | Form-based ViewDefinition editor (largest file, ~50KB) |
| `editor-code-tab-content.tsx` | Code editor tab for ViewDefinition |
| `sql-tab-content.tsx` | SQL preview tab showing generated SQL |
| `result-panel-content.tsx` | Builder's right panel (run results, schema, examples, info) |
| `example-tab-content.tsx` | Example FHIR resources display |
| `schema-tab-content.tsx` | FHIR schema tree browser |
| `info-panel.tsx` | Information/help panel |
| `search-bar.tsx` | Search functionality for schema |
| `resource-type-select.tsx` | Dropdown to select FHIR resource type |
| `code-editor-menubar.tsx` | Toolbar for code editors (mode toggle, format, copy) |
| `fhirpath-input.tsx` | FHIRPath expression input with LSP autocompletion |
| `fhirpath-lsp-context.tsx` | FHIRPath Language Server Protocol context provider |

## Key Patterns

- ViewDefinition is a SQL-on-FHIR resource type that defines tabular views over FHIR data
- The form editor allows visual editing of `select`, `where`, `forEach`, `forEachOrNull` clauses
- FHIRPath expressions use CodeMirror with LSP integration for autocomplete
- SQL tab sends the ViewDefinition to Aidbox for SQL generation and displays the result
- Running a ViewDefinition sends it to Aidbox's `$run` endpoint and displays results in a table
- The builder extensively uses `@health-samurai/react-components` for resizable panels, tabs, etc.
