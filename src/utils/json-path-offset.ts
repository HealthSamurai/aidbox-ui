export type Segment = string | number;

export function parseExpression(expression: string): Segment[] | null {
	// Strip the root resource type prefix (e.g. "ViewDefinition.")
	const dotIndex = expression.indexOf(".");
	if (dotIndex === -1) return null;
	const rest = expression.slice(dotIndex + 1);

	const segments: Segment[] = [];
	const re = /([^.[]+)|\[(\d+)\]/g;
	for (let match = re.exec(rest); match !== null; match = re.exec(rest)) {
		if (match[1] !== undefined) {
			segments.push(match[1]);
		} else if (match[2] !== undefined) {
			segments.push(Number(match[2]));
		}
	}
	return segments.length > 0 ? segments : null;
}

/**
 * Find the character offset in a JSON string that corresponds to a given
 * FHIR expression path like "ViewDefinition.select[0].column[0].name".
 *
 * Returns the offset of the opening `"` of the matched property key,
 * or `null` if the path cannot be found.
 */
export function findJsonPathOffset(
	jsonText: string,
	expression: string,
): number | null {
	const segments = parseExpression(expression);
	if (!segments) return null;

	let pos = 0;
	const len = jsonText.length;

	// Advance past whitespace
	function skipWs() {
		while (pos < len && /\s/.test(jsonText[pos] ?? "")) pos++;
	}

	// Read a JSON string starting at pos (which should be `"`), return the string value
	function readString(): string {
		if (jsonText[pos] !== '"') return "";
		pos++; // skip opening "
		let result = "";
		while (pos < len && jsonText[pos] !== '"') {
			if (jsonText[pos] === "\\") {
				pos++;
				result += jsonText[pos] ?? "";
			} else {
				result += jsonText[pos];
			}
			pos++;
		}
		pos++; // skip closing "
		return result;
	}

	// Skip a JSON value (string, number, boolean, null, object, array)
	function skipValue() {
		skipWs();
		if (pos >= len) return;
		const ch = jsonText[pos];
		if (ch === '"') {
			readString();
		} else if (ch === "{") {
			skipObject();
		} else if (ch === "[") {
			skipArray();
		} else {
			// number, boolean, null
			while (pos < len && !/[,\]}\s]/.test(jsonText[pos] ?? "")) pos++;
		}
	}

	function skipObject() {
		pos++; // skip {
		skipWs();
		if (jsonText[pos] === "}") {
			pos++;
			return;
		}
		while (pos < len) {
			skipWs();
			readString(); // key
			skipWs();
			pos++; // skip :
			skipValue();
			skipWs();
			if (jsonText[pos] === ",") {
				pos++;
			} else {
				break;
			}
		}
		skipWs();
		if (jsonText[pos] === "}") pos++;
	}

	function skipArray() {
		pos++; // skip [
		skipWs();
		if (jsonText[pos] === "]") {
			pos++;
			return;
		}
		while (pos < len) {
			skipValue();
			skipWs();
			if (jsonText[pos] === ",") {
				pos++;
			} else {
				break;
			}
		}
		skipWs();
		if (jsonText[pos] === "]") pos++;
	}

	// Navigate into an object to find a property key, position right after the `:`
	function enterObjectKey(key: string): boolean {
		skipWs();
		if (pos >= len || jsonText[pos] !== "{") return false;
		pos++; // skip {
		skipWs();
		if (jsonText[pos] === "}") return false;
		while (pos < len) {
			skipWs();
			const keyStart = pos;
			const k = readString();
			skipWs();
			pos++; // skip :
			if (k === key) {
				lastKeyOffset = keyStart;
				return true;
			}
			skipValue();
			skipWs();
			if (jsonText[pos] === ",") {
				pos++;
			} else {
				break;
			}
		}
		return false;
	}

	// Navigate into an array to index `idx`, position at the start of that element
	function enterArrayIndex(idx: number): boolean {
		skipWs();
		if (pos >= len || jsonText[pos] !== "[") return false;
		pos++; // skip [
		skipWs();
		if (jsonText[pos] === "]") return false;
		for (let i = 0; i < idx; i++) {
			skipValue();
			skipWs();
			if (jsonText[pos] === ",") {
				pos++;
			} else {
				return false;
			}
		}
		return true;
	}

	let lastKeyOffset = 0;

	for (const segment of segments) {
		if (typeof segment === "string") {
			if (!enterObjectKey(segment)) return null;
		} else {
			if (!enterArrayIndex(segment)) return null;
		}
	}

	return lastKeyOffset;
}

/** Internal mutable state used while walking the YAML structure. */
interface YamlWalkState {
	startLine: number;
	contentIndent: number;
	inlineOffset: number | null;
	lastKeyOffset: number;
}

/** Precomputed data derived from the raw YAML text. */
interface YamlLineInfo {
	lines: string[];
	lineStarts: number[];
	yamlText: string;
}

function getIndent(lines: string[], lineIdx: number): number {
	const line = lines[lineIdx] ?? "";
	let i = 0;
	while (i < line.length && line[i] === " ") i++;
	return i;
}

/** Resolve which line a character offset falls on. */
function findLineForOffset(
	lineStarts: number[],
	startLine: number,
	offset: number,
): number {
	for (let i = startLine; i < lineStarts.length; i++) {
		const isLastLine = i + 1 >= lineStarts.length;
		if (isLastLine || offset < (lineStarts[i + 1] ?? 0)) {
			return i;
		}
	}
	return startLine;
}

/**
 * Try to match a string segment against inline content that follows a `- `
 * on the same line. Returns `true` if matched (and updates `state`).
 */
function tryMatchInlineSegment(
	info: YamlLineInfo,
	state: YamlWalkState,
	segment: string,
): boolean {
	if (state.inlineOffset === null) return false;

	const rest = info.yamlText.substring(state.inlineOffset);
	if (!rest.startsWith(`${segment}:`)) {
		state.inlineOffset = null;
		return false;
	}

	state.lastKeyOffset = state.inlineOffset;
	state.contentIndent += 2;
	const lineIdx = findLineForOffset(
		info.lineStarts,
		state.startLine,
		state.inlineOffset,
	);
	state.startLine = lineIdx + 1;
	state.inlineOffset = null;
	return true;
}

/**
 * Scan subsequent lines for a YAML key matching `segment` at the current
 * indent level. Returns `true` if found (and updates `state`).
 */
function scanLinesForKey(
	info: YamlLineInfo,
	state: YamlWalkState,
	segment: string,
): boolean {
	for (let i = state.startLine; i < info.lines.length; i++) {
		const line = info.lines[i];
		if (!line || line.trim().length === 0) continue;
		const indent = getIndent(info.lines, i);
		if (indent < state.contentIndent) break;
		if (indent !== state.contentIndent) continue;

		const content = line.substring(state.contentIndent);
		if (content.startsWith(`${segment}:`)) {
			state.lastKeyOffset = (info.lineStarts[i] ?? 0) + state.contentIndent;
			state.contentIndent += 2;
			state.startLine = i + 1;
			state.inlineOffset = null;
			return true;
		}
	}
	return false;
}

/**
 * Navigate to the n-th array item (`segment`) at the current indent level.
 * Returns `true` if found (and updates `state`).
 */
function scanLinesForArrayIndex(
	info: YamlLineInfo,
	state: YamlWalkState,
	segment: number,
): boolean {
	let count = 0;
	for (let i = state.startLine; i < info.lines.length; i++) {
		const line = info.lines[i];
		if (!line || line.trim().length === 0) continue;
		const indent = getIndent(info.lines, i);
		if (indent < state.contentIndent) break;
		if (indent !== state.contentIndent) continue;

		const content = line.substring(state.contentIndent);
		if (!content.startsWith("- ") && content !== "-") continue;
		if (count !== segment) {
			count++;
			continue;
		}

		const afterDash = content.substring(2).trim();
		state.inlineOffset =
			afterDash.length > 0
				? (info.lineStarts[i] ?? 0) + state.contentIndent + 2
				: null;
		state.contentIndent += 2;
		state.startLine = i + 1;
		return true;
	}
	return false;
}

/**
 * Find the character offset in a YAML string that corresponds to a given
 * FHIR expression path like "ViewDefinition.select[0].column[0].name".
 *
 * Returns the offset of the matched property key, or `null` if not found.
 * Assumes indent=2 (js-yaml default).
 */
export function findYamlPathOffset(
	yamlText: string,
	expression: string,
): number | null {
	const segments = parseExpression(expression);
	if (!segments) return null;

	const lines = yamlText.split("\n");

	// Precompute character offset of each line start
	const lineStarts: number[] = [];
	let off = 0;
	for (const line of lines) {
		lineStarts.push(off);
		off += line.length + 1;
	}

	const info: YamlLineInfo = { lines, lineStarts, yamlText };
	const state: YamlWalkState = {
		startLine: 0,
		contentIndent: 0,
		inlineOffset: null,
		lastKeyOffset: 0,
	};

	for (const segment of segments) {
		if (typeof segment === "string") {
			const found =
				tryMatchInlineSegment(info, state, segment) ||
				scanLinesForKey(info, state, segment);
			if (!found) return null;
		} else {
			if (!scanLinesForArrayIndex(info, state, segment)) return null;
		}
	}

	return state.lastKeyOffset;
}

/**
 * Convert a character offset in text to a 1-based line number.
 */
function offsetToLineNumber(text: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < text.length; i++) {
		if (text[i] === "\n") line++;
	}
	return line;
}

/**
 * Convert FHIR expression paths from OperationOutcome issues to
 * 1-based line numbers with optional messages in editor text (JSON or YAML).
 */
/**
 * Convert OperationOutcome issues into a flat list of {expression, message}
 * with error type from details.coding as a title prefix.
 */
export function flattenOutcomeIssues(
	issues: {
		expression?: string[];
		diagnostics?: string;
		details?: { text?: string; coding?: { code?: string }[] };
	}[],
): { expression: string; message?: string }[] {
	return issues.flatMap((i) => {
		const errorType = i.details?.coding?.[0]?.code;
		const diag = i.diagnostics ?? i.details?.text;
		const message =
			errorType && diag ? `${errorType}\n${diag}` : (diag ?? errorType);
		return (i.expression ?? []).filter(Boolean).map((expr) => ({
			expression: expr,
			message,
		}));
	});
}

export function getIssueLineNumbers(
	text: string,
	issues: { expression: string; message?: string }[],
	mode: "json" | "yaml",
): { line: number; message?: string }[] {
	const result: { line: number; message?: string }[] = [];
	for (const issue of issues) {
		const offset =
			mode === "yaml"
				? findYamlPathOffset(text, issue.expression)
				: findJsonPathOffset(text, issue.expression);
		if (offset != null) {
			result.push({
				line: offsetToLineNumber(text, offset),
				message: issue.message,
			});
		}
	}
	return result;
}

/**
 * Convert OperationOutcome issues into line-number-based issue markers
 * with error tooltips. Handles missing expressions (falls back to
 * diagnostics line extraction or line 1) and merges multiple messages
 * on the same line.
 */
export function outcomeToIssueLines(
	bodyText: string,
	issues: {
		expression?: string[];
		diagnostics?: string;
		code?: string;
		details?: { text?: string; coding?: { code?: string }[] };
	}[],
	mode: "json" | "yaml",
): { line: number; message?: string }[] {
	const lineMessages = new Map<number, string[]>();

	function addLine(line: number, message: string) {
		const existing = lineMessages.get(line);
		if (existing) {
			if (!existing.includes(message)) existing.push(message);
		} else {
			lineMessages.set(line, [message]);
		}
	}

	for (const issue of issues) {
		const flat = flattenOutcomeIssues([issue]);
		const expressions: string[] = issue.expression ?? [];
		const rawMessage = flat[0]?.message ?? issue.diagnostics ?? "Error";
		const issueCode = issue.code ?? "";
		const hasTitle = rawMessage.includes("\n");
		const message =
			!hasTitle && issueCode ? `${issueCode}\n${rawMessage}` : rawMessage;

		for (const expr of expressions) {
			const offset =
				mode === "yaml"
					? findYamlPathOffset(bodyText, expr)
					: findJsonPathOffset(bodyText, expr);
			if (offset != null) {
				addLine(offsetToLineNumber(bodyText, offset), message);
			} else {
				addLine(1, message);
			}
		}

		if (expressions.length === 0) {
			const diag = issue.diagnostics ?? "";
			const lineMatch = diag.match(/line:\s*(\d+)/);
			if (lineMatch) {
				addLine(Number.parseInt(lineMatch[1] ?? "", 10), message);
			} else {
				addLine(1, message);
			}
		}
	}

	const result: { line: number; message?: string }[] = [];
	for (const [line, msgs] of lineMessages) {
		const message = msgs.length === 1 ? msgs[0] : msgs.join("\n\x00\n");
		result.push({ line, message });
	}
	return result;
}
