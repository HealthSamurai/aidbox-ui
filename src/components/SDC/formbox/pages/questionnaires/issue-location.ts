import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type { Diagnostic } from "@codemirror/lint";
import {
	parseResourceText,
	type ResourceFormat,
} from "../../shared/resource-format";
import { findYamlPathOffset } from "./yaml-issue-location";

/**
 * Maps a validation issue back onto the raw JSON the user pasted, so clicking
 * the issue can put the caret on the element it complains about. The classic
 * UI got this for free from the CodeMirror lint panel; the new dialog uses a
 * plain textarea, so the offsets are resolved by scanning the text here.
 */
export type TextRange = { end: number; start: number };

type PathSegment = number | string;

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

function skipWhitespace(text: string, index: number): number {
	let i = index;
	while (i < text.length && WHITESPACE.has(text[i] ?? "")) {
		i += 1;
	}
	return i;
}

function scanString(text: string, index: number): number {
	let i = index + 1;
	while (i < text.length) {
		if (text[i] === "\\") {
			i += 2;
			continue;
		}
		if (text[i] === '"') {
			return i + 1;
		}
		i += 1;
	}
	return text.length;
}

function scanValue(text: string, index: number): number {
	const start = skipWhitespace(text, index);
	const char = text[start];

	if (char === '"') {
		return scanString(text, start);
	}

	if (char === "{" || char === "[") {
		let depth = 0;
		let i = start;
		while (i < text.length) {
			const current = text[i];
			if (current === '"') {
				i = scanString(text, i);
				continue;
			}
			if (current === "{" || current === "[") {
				depth += 1;
			} else if (current === "}" || current === "]") {
				depth -= 1;
				if (depth === 0) {
					return i + 1;
				}
			}
			i += 1;
		}
		return text.length;
	}

	let i = start;
	while (
		i < text.length &&
		!WHITESPACE.has(text[i] ?? "") &&
		text[i] !== "," &&
		text[i] !== "}" &&
		text[i] !== "]"
	) {
		i += 1;
	}
	return i;
}

function parseKey(raw: string): string | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "string" ? parsed : null;
	} catch {
		return null;
	}
}

function findMember(
	text: string,
	objectStart: number,
	key: string,
): { keyStart: number; valueEnd: number; valueStart: number } | null {
	let i = skipWhitespace(text, objectStart);
	if (text[i] !== "{") {
		return null;
	}

	i = skipWhitespace(text, i + 1);
	while (i < text.length && text[i] !== "}") {
		if (text[i] !== '"') {
			return null;
		}
		const keyStart = i;
		const keyEnd = scanString(text, keyStart);
		i = skipWhitespace(text, keyEnd);
		if (text[i] !== ":") {
			return null;
		}
		const valueStart = skipWhitespace(text, i + 1);
		const valueEnd = scanValue(text, valueStart);
		if (parseKey(text.slice(keyStart, keyEnd)) === key) {
			return { keyStart, valueEnd, valueStart };
		}
		i = skipWhitespace(text, valueEnd);
		if (text[i] === ",") {
			i = skipWhitespace(text, i + 1);
		}
	}

	return null;
}

function findElement(
	text: string,
	arrayStart: number,
	index: number,
): TextRange | null {
	let i = skipWhitespace(text, arrayStart);
	if (text[i] !== "[") {
		return null;
	}

	i = skipWhitespace(text, i + 1);
	let position = 0;
	while (i < text.length && text[i] !== "]") {
		const start = i;
		const end = scanValue(text, start);
		if (position === index) {
			return { end, start };
		}
		position += 1;
		i = skipWhitespace(text, end);
		if (text[i] === ",") {
			i = skipWhitespace(text, i + 1);
		}
	}

	return null;
}

/** Locate indexed JSON/YAML elements for code-editor navigation. */
export function parseIssuePath(expression: string): PathSegment[] {
	const parts = expression
		.trim()
		.split(".")
		.map((part) => part.trim());
	if (parts[0] === "general" || /^[A-Z]\w*$/.test(parts[0] ?? ""))
		parts.shift();
	const path: PathSegment[] = [];
	for (const part of parts) {
		// A type cast does not change the position inside the resource.
		if (/^ofType\([A-Za-z]\w*\)$/.test(part)) continue;
		if (/^\d+$/.test(part)) {
			path.push(Number(part));
			continue;
		}
		const match = /^([A-Za-z_]\w*)((?:\[\d+\])*)$/.exec(part);
		// Selectors such as where() cannot be resolved to a positional input.
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
 * The dialog also accepts a Bundle and validates `entry[0].resource`, so the
 * issue paths come back relative to that Questionnaire while the editor holds
 * the whole Bundle. Locating issues therefore starts at the validated resource,
 * not at the document root.
 */
export function findValidatedResourceStart(text: string): number {
	const root = skipWhitespace(text, 0);

	const resourceType = findMember(text, root, "resourceType");
	if (
		!resourceType ||
		parseKey(text.slice(resourceType.valueStart, resourceType.valueEnd)) !==
			"Bundle"
	) {
		return root;
	}

	const entry = findMember(text, root, "entry");
	if (!entry) {
		return root;
	}

	const first = findElement(text, entry.valueStart, 0);
	if (!first) {
		return root;
	}

	const resource = findMember(text, first.start, "resource");

	return resource ? resource.valueStart : root;
}

/**
 * Resolves the deepest part of the path that the text actually contains, so a
 * missing required property still points at the object that misses it.
 */
function walkPath(
	text: string,
	path: PathSegment[],
	start: number,
): TextRange | null {
	let cursor = start;
	let range: TextRange | null = null;

	for (const segment of path) {
		if (typeof segment === "number") {
			const element = findElement(text, cursor, segment);
			if (!element) {
				return range;
			}
			cursor = element.start;
			range = element;
			continue;
		}

		const member = findMember(text, cursor, segment);
		if (!member) {
			return range;
		}
		cursor = member.valueStart;
		range = { end: member.valueEnd, start: member.keyStart };
	}

	return range;
}

export function findIssueTextRange(
	text: string,
	expression: string | null,
	format: ResourceFormat = "json",
): TextRange | null {
	if (!expression) {
		return null;
	}

	const path = parseIssuePath(expression);
	if (path.length === 0) {
		return null;
	}

	if (format === "yaml") {
		let yamlPath = path;
		try {
			const resource = parseResourceText(text, format);
			if (
				resource &&
				typeof resource === "object" &&
				"resourceType" in resource &&
				resource.resourceType === "Bundle" &&
				path[0] !== "entry"
			) {
				yamlPath = ["entry", 0, "resource", ...path];
			}
		} catch {
			// Keep the same best-effort issue navigation while the user is typing.
		}
		const start = findYamlPathOffset(text, yamlPath);
		if (start == null) return null;
		const lineEnd = text.indexOf("\n", start);
		return { start, end: lineEnd < 0 ? text.length : lineEnd };
	}

	const documentRoot = skipWhitespace(text, 0);
	const resourceRoot = findValidatedResourceStart(text);
	const range = walkPath(text, path, resourceRoot);
	if (range || resourceRoot === documentRoot) {
		return range;
	}

	// An expression spelled from the Bundle down (`Bundle.entry[0].resource...`)
	// resolves from the document root instead.
	return walkPath(text, path, documentRoot);
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
		if (!range) {
			return [];
		}

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
