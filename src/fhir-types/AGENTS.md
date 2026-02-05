# fhir-types/

Auto-generated FHIR type definitions. Generated via `pnpm generate-types` (runs `scripts/generate-types.ts` using `@atomic-ehr/codegen`).

**Do not edit these files manually.**

## Structure

| Directory | Description |
|-----------|-------------|
| `hl7-fhir-r5-core/` | FHIR R5 core type definitions (~49 files). Includes: Resource, Bundle, OperationOutcome, Patient, Coding, Address, HumanName, Identifier, etc. |
| `org-sql-on-fhir-ig/` | SQL-on-FHIR Implementation Guide types. Main type: `ViewDefinition` with its nested `Select`, `Column`, `Where`, `ForEach` structures. |

## Usage

```ts
import type { Resource, Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
```
