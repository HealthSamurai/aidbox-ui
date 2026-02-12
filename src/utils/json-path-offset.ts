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
		while (pos < len && /\s/.test(jsonText[pos])) pos++;
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
			while (pos < len && !/[,\]}\s]/.test(jsonText[pos])) pos++;
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

	function getIndent(lineIdx: number): number {
		const line = lines[lineIdx];
		let i = 0;
		while (i < line.length && line[i] === " ") i++;
		return i;
	}

	let startLine = 0;
	let contentIndent = 0;
	// After entering an array item, inline content (on the same `- ` line) offset
	let inlineOffset: number | null = null;
	let lastKeyOffset = 0;

	for (const segment of segments) {
		if (typeof segment === "string") {
			let found = false;

			// Check inline content first (key on the same line as `- `)
			if (inlineOffset !== null) {
				const rest = yamlText.substring(inlineOffset);
				if (rest.startsWith(`${segment}:`)) {
					lastKeyOffset = inlineOffset;
					contentIndent += 2;
					// Find which line this offset is on
					let lineIdx = startLine;
					for (let i = startLine; i < lineStarts.length; i++) {
						if (
							i + 1 < lineStarts.length
								? inlineOffset < lineStarts[i + 1]
								: true
						) {
							lineIdx = i;
							break;
						}
					}
					startLine = lineIdx + 1;
					inlineOffset = null;
					found = true;
				} else {
					inlineOffset = null;
				}
			}

			if (!found) {
				for (let i = startLine; i < lines.length; i++) {
					const line = lines[i];
					if (line.trim().length === 0) continue;
					const indent = getIndent(i);
					if (indent < contentIndent) break;
					if (indent !== contentIndent) continue;

					const content = line.substring(contentIndent);
					if (content.startsWith(`${segment}:`)) {
						lastKeyOffset = lineStarts[i] + contentIndent;
						contentIndent += 2;
						startLine = i + 1;
						inlineOffset = null;
						found = true;
						break;
					}
				}
			}

			if (!found) return null;
		} else {
			// Array index
			let count = 0;
			let found = false;

			for (let i = startLine; i < lines.length; i++) {
				const line = lines[i];
				if (line.trim().length === 0) continue;
				const indent = getIndent(i);
				if (indent < contentIndent) break;
				if (indent !== contentIndent) continue;

				const content = line.substring(contentIndent);
				if (content.startsWith("- ") || content === "-") {
					if (count === segment) {
						const afterDash = content.substring(2).trim();
						if (afterDash.length > 0) {
							inlineOffset = lineStarts[i] + contentIndent + 2;
						} else {
							inlineOffset = null;
						}
						contentIndent += 2;
						startLine = i + 1;
						found = true;
						break;
					}
					count++;
				}
			}

			if (!found) return null;
		}
	}

	return lastKeyOffset;
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
 * 1-based line numbers in editor text (JSON or YAML).
 */
export function getIssueLineNumbers(
	text: string,
	expressions: string[],
	mode: "json" | "yaml",
): number[] {
	const lineNumbers: number[] = [];
	for (const expression of expressions) {
		const offset =
			mode === "yaml"
				? findYamlPathOffset(text, expression)
				: findJsonPathOffset(text, expression);
		if (offset != null) {
			lineNumbers.push(offsetToLineNumber(text, offset));
		}
	}
	return lineNumbers;
}
