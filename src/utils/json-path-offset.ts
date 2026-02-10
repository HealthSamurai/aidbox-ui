type Segment = string | number;

function parseExpression(expression: string): Segment[] | null {
	// Strip the root resource type prefix (e.g. "ViewDefinition.")
	const dotIndex = expression.indexOf(".");
	if (dotIndex === -1) return null;
	const rest = expression.slice(dotIndex + 1);

	const segments: Segment[] = [];
	const re = /([^.[]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(rest)) !== null) {
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
