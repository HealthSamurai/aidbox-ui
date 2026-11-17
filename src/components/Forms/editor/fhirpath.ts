import { parser } from "lezer-fhirpath";

/** Quote a FHIRPath string without interpreting its contents as an expression. */
export function fhirpathString(value: string): string {
	return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}'`;
}

/** Action IDs may contain dots and hyphens, which require a delimited identifier. */
export function fhirpathVariable(name: string): string {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
		? `%${name}`
		: `%\`${name.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``;
}

/** Read a quoted FHIRPath value or identifier, including escaped characters. */
export function unquoteFhirpath(value: string): string {
	return value
		.slice(1, -1)
		.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, escaped: string) => {
			if (escaped.length === 5 && escaped.startsWith("u"))
				return String.fromCharCode(Number.parseInt(escaped.slice(1), 16));
			return (
				({ n: "\n", r: "\r", t: "\t", f: "\f" } as Record<string, string>)[
					escaped
				] ?? escaped
			);
		});
}

/** Read external variables without treating comments or string contents as references. */
export function fhirpathVariables(expression: string): Set<string> {
	const references = new Set<string>();
	let invalid = false;
	parser.parse(expression).iterate({
		enter(node) {
			if (node.type.isError) invalid = true;
			if (node.name !== "ExternalConstant") return;
			const identifier =
				node.node.getChild("Identifier") ?? node.node.getChild("String");
			if (!identifier) return;
			const value = expression.slice(identifier.from, identifier.to);
			references.add(/^[`']/.test(value) ? unquoteFhirpath(value) : value);
		},
	});
	return invalid ? new Set() : references;
}

/** Remove insignificant whitespace and comments while preserving quoted values. */
export function compactFhirpath(expression: string): string | undefined {
	let compact = "";
	let invalid = false;
	parser.parse(expression).iterate({
		enter(node) {
			if (node.type.isError) invalid = true;
			if (["LineComment", "BlockComment"].includes(node.name)) return false;
			if (!node.node.firstChild)
				compact += expression.slice(node.from, node.to);
		},
	});
	return invalid ? undefined : compact;
}
