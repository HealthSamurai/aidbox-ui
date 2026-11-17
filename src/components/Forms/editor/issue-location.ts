import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import {
	findJsonPathOffset,
	findYamlPathOffset,
	type Segment,
} from "@aidbox-ui/utils/json-path-offset";
import type { Diagnostic } from "@codemirror/lint";
import { parseResourceText, type ResourceFormat } from "./resource-format";

/** Where an issue points in the editor text: its key up to the end of that line. */
export type TextRange = { end: number; start: number };

/**
 * The path of an issue expression inside the resource. Type casts do not move
 * the position; selectors such as `where()` cannot be resolved, so they give no
 * path at all.
 */
function parseIssuePath(expression: string): Segment[] {
	const parts = expression
		.trim()
		.split(".")
		.map((part) => part.trim());
	if (parts[0] === "general" || /^[A-Z]\w*$/.test(parts[0] ?? ""))
		parts.shift();
	const path: Segment[] = [];
	for (const part of parts) {
		if (/^ofType\([A-Za-z]\w*\)$/.test(part)) continue;
		if (/^\d+$/.test(part)) {
			path.push(Number(part));
			continue;
		}
		const match = /^([A-Za-z_]\w*)((?:\[\d+\])*)$/.exec(part);
		if (!match) return [];
		path.push(match[1] as string);
		for (const index of (match[2] ?? "").matchAll(/\[(\d+)\]/g))
			path.push(Number(index[1]));
	}
	return path;
}

export function getIssueExpression(
	issue: OperationOutcomeIssue,
): string | null {
	return issue.expression?.[0] ?? issue.location?.[0] ?? null;
}

/**
 * The import dialog also accepts a Bundle and validates `entry[0].resource`, so
 * issue paths come back relative to that Questionnaire while the editor holds
 * the whole Bundle.
 */
function isBundleText(text: string, format: ResourceFormat) {
	try {
		const resource = parseResourceText(text, format);
		return (
			typeof resource === "object" &&
			resource !== null &&
			"resourceType" in resource &&
			resource.resourceType === "Bundle"
		);
	} catch {
		// Best effort while the user is typing.
		return false;
	}
}

export function findIssueTextRange(
	text: string,
	expression: string | null,
	format: ResourceFormat = "json",
): TextRange | null {
	if (!expression) return null;
	const path = parseIssuePath(expression);
	if (path.length === 0) return null;

	const fullPath =
		path[0] !== "entry" && isBundleText(text, format)
			? ["entry", 0, "resource", ...path]
			: path;
	const start = (format === "yaml" ? findYamlPathOffset : findJsonPathOffset)(
		text,
		fullPath,
		{ deepest: true },
	);
	if (start == null) return null;
	const lineEnd = text.indexOf("\n", start);
	return { start, end: lineEnd < 0 ? text.length : lineEnd };
}

/**
 * Turns validation issues into CodeMirror lint diagnostics, so the editor
 * underlines the offending element and shows the message on hover — the same
 * feedback the classic UI's linter gave.
 */
export function buildIssueDiagnostics(
	text: string,
	issues: OperationOutcomeIssue[],
	format: ResourceFormat = "json",
): Diagnostic[] {
	return issues.flatMap((issue) => {
		const expression = getIssueExpression(issue);
		const range = findIssueTextRange(text, expression, format);
		if (!range) return [];

		const message = issue.diagnostics ?? issue.details?.text ?? issue.code;

		return [
			{
				from: range.start,
				message: expression ? `${message} at: ${expression}` : message,
				severity: issue.severity === "warning" ? "warning" : "error",
				to: Math.min(range.end, text.length),
			},
		];
	});
}
