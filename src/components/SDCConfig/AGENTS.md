# SDCConfig

Form editor for the `SDCConfig` resource, shown as the Builder tab of ResourceEditor (`/resource/SDCConfig/edit/:id`). Wired in `ResourceEditor/page.tsx` through `SDCConfigBuilderContent`.

| File | Description |
|------|-------------|
| `builder-content.tsx` | Builder tab: sidebar and form over the edited resource |
| `schema.ts` | Sections and fields of SDCConfig, the source of the form |
| `customizable-messages-schema.json` | Schema of the translatable SDC messages, used by the translations editor |
| `field-definitions.ts`, `form-values.ts` | Field types and resource ⇄ form values mapping |
| `renderer.tsx`, `form.tsx`, `select.tsx`, `nullable-boolean-field.tsx` | Rendering of sections and fields |
| `editor-sidebar.tsx` | Section navigation and search |
| `api.ts` | Lookups for the form (QuestionnaireTheme and others) |

## Customizable messages schema

`customizable-messages-schema.json` is a copy of `box/resources/sdc/customizable-messages-schema.json` from sansara, where `make gettext` generates it. Do not edit it here: when the box adds or renames customizable messages, copy the file again.
