import type {
	CompletionContext,
	CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, type Extension } from "@codemirror/state";
import type { Snapshot } from "../ViewDefinition/types";

export type FhirFieldInfo = {
	name: string;
	datatype: string;
	isArray: boolean;
	description?: string;
};

export type FhirPathChildren = Record<string, FhirFieldInfo[]>;

export type JsonbColumnMap = Record<string, string[]>;

export type ColumnInfo = { name: string; dataType: string };
export type ColumnMap = Record<string, ColumnInfo[]>;

type JsonbChain = {
	tableOrAlias: string | null;
	column: string;
	path: string[];
	isPathOp: boolean;
	partialInput: string;
	insideQuote: boolean;
	lastRawSegment: string | null;
};

type AliasEntry = { schema: string; table: string };

export type JsonbCompletionCtx = {
	schemas: Record<string, string[]>;
	jsonbColumns: JsonbColumnMap;
	resourceTypes: Set<string>;
	fhirSchemaCache: Record<string, FhirPathChildren>;
	fetchFhirSchema: (resourceType: string) => Promise<FhirPathChildren | null>;
};

export type ColumnCompletionCtx = {
	schemas: Record<string, string[]>;
	columns: ColumnMap;
};

const SQL_TABLE_KEYWORDS =
	/\b(?:from|join|inner\s+join|left\s+join|right\s+join|full\s+join|cross\s+join|into|update|table)\s+$/i;

const FHIR_PRIMITIVE_TYPES = new Set([
	"boolean",
	"positiveInt",
	"unsignedInt",
	"url",
	"string",
	"uri",
	"id",
	"dateTime",
	"oid",
	"uuid",
	"canonical",
	"time",
	"integer",
	"date",
	"markdown",
	"base64Binary",
	"instant",
	"code",
	"decimal",
]);

function fhirVariantToAidboxKey(baseName: string, variantName: string): string {
	const suffix = variantName.slice(baseName.length);
	const decapitalized = suffix[0].toLowerCase() + suffix.slice(1);
	return FHIR_PRIMITIVE_TYPES.has(decapitalized) ? decapitalized : suffix;
}

export function buildFhirPathChildren(snapshot: Snapshot[]): FhirPathChildren {
	const result: FhirPathChildren = {};

	for (const el of snapshot) {
		if (el.type === "root" || !el.path) continue;

		const parts = el.path.split(".");
		if (parts.length < 2) continue;

		const parentPath = parts.slice(0, -1).join(".");
		if (!result[parentPath]) result[parentPath] = [];

		if (result[parentPath].some((existing) => existing.name === el.name))
			continue;

		result[parentPath].push({
			name: el.name,
			datatype: el.datatype ?? el.type ?? "",
			isArray: el.max === "*",
			description: el.short ?? el.desc,
		});
	}

	return result;
}

function transformUnionTypes(
	result: FhirPathChildren,
	snapshot: Snapshot[],
): void {
	const unionParents = snapshot.filter(
		(el) => el["union?"] === true && el.path,
	);

	for (const unionEl of unionParents) {
		const unionPath = unionEl.path as string;
		const parts = unionPath.split(".");
		const baseName = parts[parts.length - 1];
		const resourceParentPath = parts.slice(0, -1).join(".");

		const parentChildren = result[resourceParentPath];
		if (!parentChildren) continue;

		const variants: FhirFieldInfo[] = [];
		const nonVariants: FhirFieldInfo[] = [];

		for (const child of parentChildren) {
			if (
				child.name !== baseName &&
				child.name.startsWith(baseName) &&
				child.name.length > baseName.length &&
				/^[A-Z]/.test(child.name.slice(baseName.length))
			) {
				variants.push(child);
			} else if (child.name !== baseName) {
				nonVariants.push(child);
			}
		}

		if (variants.length === 0) continue;

		const aidboxChildren: FhirFieldInfo[] = variants.map((variant) => ({
			name: fhirVariantToAidboxKey(baseName, variant.name),
			datatype: variant.datatype,
			isArray: variant.isArray,
			description: variant.description,
		}));

		result[unionPath] = aidboxChildren;

		const unionEntry: FhirFieldInfo = {
			name: baseName,
			datatype: "union",
			isArray: unionEl.max === "*",
			description: unionEl.short ?? unionEl.desc,
		};
		result[resourceParentPath] = [...nonVariants, unionEntry];

		for (const variant of variants) {
			const fhirVariantPath = `${resourceParentPath}.${variant.name}`;
			const aidboxKey = fhirVariantToAidboxKey(baseName, variant.name);
			const aidboxVariantPath = `${unionPath}.${aidboxKey}`;

			if (result[fhirVariantPath]) {
				result[aidboxVariantPath] = result[fhirVariantPath];
				delete result[fhirVariantPath];
			}

			for (const key of Object.keys(result)) {
				if (key.startsWith(`${fhirVariantPath}.`)) {
					const suffix = key.slice(fhirVariantPath.length);
					result[aidboxVariantPath + suffix] = result[key];
					delete result[key];
				}
			}
		}
	}
}

function transformReferenceFields(result: FhirPathChildren): void {
	for (const [path, children] of Object.entries(result)) {
		const hasReferenceField = children.some((c) => c.name === "reference");
		if (!hasReferenceField) continue;

		result[path] = children.flatMap((child) => {
			if (child.name === "reference") {
				return [
					{
						name: "id",
						datatype: "string",
						isArray: false,
						description: "Resource ID",
					},
					{
						name: "resourceType",
						datatype: "string",
						isArray: false,
						description: "Resource type",
					},
				];
			}
			return [child];
		});
	}
}

export function transformToAidboxFormat(
	result: FhirPathChildren,
	snapshot: Snapshot[],
): void {
	transformUnionTypes(result, snapshot);
	transformReferenceFields(result);
}

function parseJsonbChain(textBefore: string): JsonbChain | null {
	const pathOpMatch = textBefore.match(/((?:\w+\.)?\w+)\s*#>>?\s*'\{([^}]*)$/);
	if (pathOpMatch) {
		const ref = pathOpMatch[1];
		const pathContent = pathOpMatch[2];
		const segments = pathContent ? pathContent.split(",") : [];
		const partialInput = segments.length > 0 ? (segments.pop() ?? "") : "";
		const lastRawSegment =
			segments.length > 0 ? segments[segments.length - 1] : null;
		const path = segments.filter((s) => !/^\d+$/.test(s));

		const dotParts = ref.split(".");
		if (dotParts.length === 2) {
			return {
				tableOrAlias: dotParts[0],
				column: dotParts[1],
				path,
				isPathOp: true,
				partialInput,
				insideQuote: false,
				lastRawSegment,
			};
		}
		return {
			tableOrAlias: null,
			column: dotParts[0],
			path,
			isPathOp: true,
			partialInput,
			insideQuote: false,
			lastRawSegment,
		};
	}

	const arrowPattern =
		/(?:((?:\w+\.)?\w+)((?:\s*->>?\s*(?:'[^']*'|\d+))*)\s*->>?\s*)('?)([^']*)?$/;
	const arrowMatch = textBefore.match(arrowPattern);
	if (!arrowMatch) return null;

	const ref = arrowMatch[1];
	const chainPart = arrowMatch[2] || "";
	const insideQuote = arrowMatch[3] === "'";
	const partialInput = arrowMatch[4] ?? "";

	const chainSegments: string[] = [];
	let lastRawSeg: string | null = null;
	const segmentRegex = /->>?\s*(?:'([^']*)'|(\d+))/g;
	for (
		let m = segmentRegex.exec(chainPart);
		m !== null;
		m = segmentRegex.exec(chainPart)
	) {
		const seg = m[1] ?? m[2];
		lastRawSeg = seg;
		if (!/^\d+$/.test(seg)) {
			chainSegments.push(seg);
		}
	}

	const dotParts = ref.split(".");
	if (dotParts.length === 2) {
		return {
			tableOrAlias: dotParts[0],
			column: dotParts[1],
			path: chainSegments,
			isPathOp: false,
			partialInput,
			insideQuote,
			lastRawSegment: lastRawSeg,
		};
	}
	return {
		tableOrAlias: null,
		column: dotParts[0],
		path: chainSegments,
		isPathOp: false,
		partialInput,
		insideQuote,
		lastRawSegment: lastRawSeg,
	};
}

function buildAliasMap(
	sql: string,
	schemas: Record<string, string[]>,
): Record<string, AliasEntry> {
	const aliases: Record<string, AliasEntry> = {};
	const regex = /\b(?:FROM|JOIN)\s+((?:\w+\.)?\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;

	for (let match = regex.exec(sql); match !== null; match = regex.exec(sql)) {
		const fullTable = match[1];
		const alias = match[2];

		let schema: string;
		let table: string;
		if (fullTable.includes(".")) {
			const parts = fullTable.split(".");
			schema = parts[0];
			table = parts[1];
		} else {
			table = fullTable;
			let found: string | null = null;
			for (const [s, tables] of Object.entries(schemas)) {
				if (tables.includes(table)) {
					found = s;
					if (s === "public") break;
				}
			}
			schema = found ?? "public";
		}

		if (alias) {
			aliases[alias.toLowerCase()] = { schema, table };
		}
		aliases[table.toLowerCase()] = { schema, table };
	}

	return aliases;
}

function tableToResourceType(
	table: string,
	resourceTypes: Set<string>,
): string | null {
	const pascal = table
		.split("_")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
	return resourceTypes.has(pascal) ? pascal : null;
}

function getCurrentStatement(doc: string, pos: number): string {
	let start = 0;
	let end = doc.length;

	const before = doc.lastIndexOf(";", pos - 1);
	if (before !== -1) start = before + 1;

	const after = doc.indexOf(";", pos);
	if (after !== -1) end = after;

	return doc.slice(start, end);
}

function buildJsonbResult(
	chain: JsonbChain,
	pathChildren: FhirPathChildren,
	resourceType: string,
	context: CompletionContext,
): CompletionResult | null {
	const lookupPath =
		chain.path.length > 0
			? `${resourceType}.${chain.path.join(".")}`
			: resourceType;

	const children = pathChildren[lookupPath];
	if (!children || children.length === 0) return null;

	const partial = chain.partialInput.toLowerCase();
	const filtered = partial
		? children.filter((f) => f.name.toLowerCase().startsWith(partial))
		: children;

	if (filtered.length === 0) return null;

	if (chain.isPathOp) {
		return {
			from: context.pos - chain.partialInput.length,
			validFor: /^\w*$/,
			options: filtered.map((f) => ({
				label: f.name,
				type: "property",
				detail: f.datatype + (f.isArray ? "[]" : ""),
				info: f.description,
			})),
		};
	}

	if (chain.insideQuote) {
		return {
			from: context.pos - chain.partialInput.length,
			validFor: /^\w*$/,
			options: filtered.map((f) => ({
				label: f.name,
				type: "property",
				detail: f.datatype + (f.isArray ? "[]" : ""),
				info: f.description,
				apply: (view, _completion, from, to) => {
					const after = view.state.sliceDoc(to, to + 1);
					const end = after === "'" ? to + 1 : to;
					const insert = `${f.name}'`;
					view.dispatch({
						changes: { from, to: end, insert },
						selection: { anchor: from + insert.length },
					});
				},
			})),
		};
	}

	return {
		from: context.pos - chain.partialInput.length,
		validFor: /^'?\w*'?$/,
		options: filtered.map((f) => ({
			label: `'${f.name}'`,
			type: "property",
			detail: f.datatype + (f.isArray ? "[]" : ""),
			info: f.description,
			apply: `'${f.name}'`,
		})),
	};
}

function isArrayPosition(
	chain: JsonbChain,
	pathChildren: FhirPathChildren,
	resourceType: string,
): boolean {
	if (!chain.lastRawSegment || /^\d+$/.test(chain.lastRawSegment)) return false;

	if (!chain.isPathOp && chain.insideQuote) return false;

	const fieldName = chain.lastRawSegment;
	const parentPath =
		chain.path.length > 1
			? `${resourceType}.${chain.path.slice(0, -1).join(".")}`
			: resourceType;
	const parentChildren = pathChildren[parentPath];
	if (!parentChildren) return false;

	const element = parentChildren.find((f) => f.name === fieldName);
	return !!element?.isArray;
}

async function resolveNestedTypes(
	pathChildren: FhirPathChildren,
	resourceType: string,
	path: string[],
	fetchFhirSchema: (type: string) => Promise<FhirPathChildren | null>,
): Promise<void> {
	for (let i = 0; i < path.length; i++) {
		const currentPath = `${resourceType}.${path.slice(0, i + 1).join(".")}`;

		if (pathChildren[currentPath]) continue;

		const parentPath =
			i === 0 ? resourceType : `${resourceType}.${path.slice(0, i).join(".")}`;
		const parentChildren = pathChildren[parentPath];
		if (!parentChildren) return;

		const segmentName = path[i];
		const element = parentChildren.find((f) => f.name === segmentName);
		if (!element?.datatype) return;

		if (element.datatype === "union") continue;

		const firstChar = element.datatype[0];
		if (firstChar !== firstChar.toUpperCase()) return;

		const typeChildren = await fetchFhirSchema(element.datatype);
		if (!typeChildren) return;

		const typeName = element.datatype;
		for (const [key, children] of Object.entries(typeChildren)) {
			const suffix = key === typeName ? "" : key.slice(typeName.length);
			pathChildren[currentPath + suffix] = children;
		}
	}
}

export function jsonbCompletionExtension(ctx: JsonbCompletionCtx): Extension {
	const resolveChain = (
		context: CompletionContext,
	): { chain: JsonbChain; resourceType: string } | null => {
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = line.text.slice(0, context.pos - line.from);

		const chain = parseJsonbChain(textBefore);
		if (!chain) return null;

		const fullDoc = context.state.doc.toString();
		const statement = getCurrentStatement(fullDoc, context.pos);
		const aliases = buildAliasMap(statement, ctx.schemas);

		let resolved: AliasEntry | null = null;

		if (chain.tableOrAlias) {
			resolved = aliases[chain.tableOrAlias.toLowerCase()] ?? null;
		} else {
			for (const entry of Object.values(aliases)) {
				const key = `${entry.schema}.${entry.table}`;
				const cols = ctx.jsonbColumns[key];
				if (cols?.includes(chain.column)) {
					resolved = entry;
					break;
				}
			}
		}

		if (!resolved) return null;

		const jsonbKey = `${resolved.schema}.${resolved.table}`;
		const jsonbCols = ctx.jsonbColumns[jsonbKey];
		if (!jsonbCols?.includes(chain.column)) return null;

		const resourceType =
			chain.column === "resource"
				? tableToResourceType(resolved.table, ctx.resourceTypes)
				: null;

		if (!resourceType) return null;

		return { chain, resourceType };
	};

	const complete = async (
		chain: JsonbChain,
		resourceType: string,
		pathChildren: FhirPathChildren,
		context: CompletionContext,
	): Promise<CompletionResult | null> => {
		if (chain.path.length > 0) {
			await resolveNestedTypes(
				pathChildren,
				resourceType,
				chain.path,
				ctx.fetchFhirSchema,
			);
		}

		if (isArrayPosition(chain, pathChildren, resourceType)) return null;

		return buildJsonbResult(chain, pathChildren, resourceType, context);
	};

	const source = (
		context: CompletionContext,
	): CompletionResult | null | Promise<CompletionResult | null> => {
		const info = resolveChain(context);
		if (!info) return null;

		const { chain, resourceType } = info;

		const cached = ctx.fhirSchemaCache[resourceType];
		if (cached) {
			if (chain.path.length === 0) {
				return buildJsonbResult(chain, cached, resourceType, context);
			}
			return complete(chain, resourceType, cached, context);
		}

		return ctx.fetchFhirSchema(resourceType).then((fetched) => {
			if (!fetched) return null;
			return complete(chain, resourceType, fetched, context);
		});
	};

	return EditorState.languageData.of(() => [{ autocomplete: source }]);
}

export function isInJsonbContext(textBefore: string): boolean {
	return parseJsonbChain(textBefore) !== null;
}

export function isInsideString(textBefore: string): boolean {
	let count = 0;
	for (let i = 0; i < textBefore.length; i++) {
		if (textBefore[i] === "'") {
			if (i + 1 < textBefore.length && textBefore[i + 1] === "'") {
				i++;
			} else {
				count++;
			}
		}
	}
	return count % 2 !== 0;
}

export function columnCompletionExtension(ctx: ColumnCompletionCtx): Extension {
	const source = (context: CompletionContext): CompletionResult | null => {
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = line.text.slice(0, context.pos - line.from);

		if (isInsideString(textBefore)) return null;

		const fullDoc = context.state.doc.toString();
		const statement = getCurrentStatement(fullDoc, context.pos);
		const aliases = buildAliasMap(statement, ctx.schemas);

		if (Object.keys(aliases).length === 0) return null;

		// Case 1: alias.partial → columns for that alias
		const aliasDot = textBefore.match(/(\w+)\.(\w*)$/);
		if (aliasDot) {
			const beforeAlias = textBefore.slice(
				0,
				textBefore.length - aliasDot[0].length,
			);
			if (SQL_TABLE_KEYWORDS.test(beforeAlias)) return null;

			const aliasName = aliasDot[1];
			const entry = aliases[aliasName.toLowerCase()];
			if (!entry) return null;
			const key = `${entry.schema}.${entry.table}`;
			const cols = ctx.columns[key];
			if (!cols || cols.length === 0) return null;

			return {
				from: context.pos - aliasDot[2].length,
				options: cols.map((c) => ({
					label: c.name,
					type: "variable",
					detail: c.dataType,
				})),
			};
		}

		// Case 2: suggest columns from all in-scope tables
		const word = context.matchBefore(/\w*/);
		if (!word) return null;
		if (word.from === word.to && !context.explicit) return null;

		const textBeforeWord = textBefore.slice(0, word.from - line.from);
		if (SQL_TABLE_KEYWORDS.test(textBeforeWord)) return null;

		const seen = new Set<string>();
		const options: { label: string; type: string; detail: string }[] = [];
		for (const entry of Object.values(aliases)) {
			const key = `${entry.schema}.${entry.table}`;
			const cols = ctx.columns[key];
			if (!cols) continue;
			for (const c of cols) {
				const dedup = `${c.name}::${entry.table}`;
				if (seen.has(dedup)) continue;
				seen.add(dedup);
				options.push({
					label: c.name,
					type: "variable",
					detail: `${c.dataType} · ${entry.table}`,
				});
			}
		}

		if (options.length === 0) return null;
		return { from: word.from, options };
	};

	return EditorState.languageData.of(() => [{ autocomplete: source }]);
}
