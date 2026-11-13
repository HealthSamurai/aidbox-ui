// Ported from aidbox-ui/src/utils/json-path-offset.ts. Formbox supplies parsed
// R4 paths and keeps the deepest match for missing-property diagnostics.

/** Internal mutable state used while walking the YAML structure. */
interface YamlWalkState {
	startLine: number;
	contentIndent: number;
	inlineOffset: number | null;
	lastKeyOffset: number | null;
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
		// Array traversal already advanced startLine past this inline key.
		Math.max(0, state.startLine - 1),
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
 * Returns the offset of the deepest matched property key, or `null` if not found.
 * Assumes indent=2 (js-yaml default).
 */
export function findYamlPathOffset(
	yamlText: string,
	segments: (string | number)[],
): number | null {
	if (!segments.length) return null;

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
		lastKeyOffset: null,
	};

	for (const segment of segments) {
		if (typeof segment === "string") {
			const found =
				tryMatchInlineSegment(info, state, segment) ||
				scanLinesForKey(info, state, segment);
			if (!found) return state.lastKeyOffset;
		} else {
			if (!scanLinesForArrayIndex(info, state, segment))
				return state.lastKeyOffset;
		}
	}

	return state.lastKeyOffset;
}
