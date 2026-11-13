/** Formbox exposes its editors to browser agents; Aidbox UI does not (yet). */
export type FormboxTool = {
	name: string;
	description: string;
	inputSchema: unknown;
	annotations?: unknown;
	execute: (args: never) => unknown;
};

export function useWebMCPTools(_tools: FormboxTool[]) {}

export const NO_ARGUMENTS = {
	type: "object" as const,
	properties: {},
	additionalProperties: false,
};
