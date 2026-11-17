import { validateResourceShape } from "@aidbox-ui/components/Forms/editor/resource-code";
import { z } from "zod";

const string = z.string().optional();
const expression = z
	.object({ language: string, expression: string })
	.passthrough();
const extension: z.ZodType = z.lazy(() =>
	z
		.object({
			id: string,
			url: z.string(),
			valueString: string,
			valueExpression: expression.optional(),
			extension: z.array(extension).optional(),
		})
		.passthrough(),
);

// Validate only fields interpreted by the visual editor. Unknown FHIR properties
// stay on the original object; this schema is a guard, never a serializer.
const planDefinitionCodeSchema = z
	.object({
		resourceType: z.literal("PlanDefinition"),
		id: string,
		title: string,
		url: string,
		version: string,
		name: string,
		description: string,
		status: z.enum(["draft", "active", "retired", "unknown"]),
		action: z
			.array(
				z
					.object({
						id: string,
						title: string,
						description: string,
						definitionCanonical: string,
						definitionUri: string,
						selectionBehavior: string,
						action: z.array(z.unknown()).optional(),
						dynamicValue: z.array(z.unknown()).optional(),
						relatedAction: z.array(z.unknown()).optional(),
						conditionEditor: z.never().optional(),
						condition: z
							.array(
								z
									.object({
										id: string,
										kind: z.string(),
										expression: expression.optional(),
									})
									.passthrough(),
							)
							.optional(),
						extension: z.array(extension).optional(),
					})
					.passthrough(),
			)
			.optional(),
	})
	.passthrough();

export function validatePlanDefinitionCode(value: unknown) {
	validateResourceShape(planDefinitionCodeSchema, value);
}
