import type { CompletionContext } from "@codemirror/autocomplete";
import type { GetStructureDefinitions } from "@health-samurai/react-components";
import { parser } from "lezer-fhirpath";
import type { FhirpathVariable } from "./fhirpath-editor";

type Element = {
	path?: string;
	short?: string;
	definition?: string;
	type?: { code?: string }[];
};
type Definition = {
	snapshot?: { element?: Element[] };
	differential?: { element?: Element[] };
};
const caches = new WeakMap<
	GetStructureDefinitions,
	Map<string, Promise<Definition | undefined>>
>();

/** Resolve fields of typed PlanDefinition variables without rewriting the expression. */
export function fhirpathFieldCompletion(
	variables: FhirpathVariable[],
	getDefinitions: GetStructureDefinitions,
) {
	let definitions = caches.get(getDefinitions);
	if (!definitions) {
		definitions = new Map();
		caches.set(getDefinitions, definitions);
	}
	const cache = definitions;
	const definition = (type: string) => {
		let pending = cache.get(type);
		if (!pending) {
			pending = getDefinitions({ type, derivation: "specialization" })
				.then((results) => {
					if (!results.length) cache.delete(type);
					return results[0] as Definition | undefined;
				})
				.catch(() => {
					cache.delete(type);
					return undefined;
				});
			cache.set(type, pending);
		}
		return pending;
	};
	const children = async (type: string, path: string[]): Promise<Element[]> => {
		const schema = await definition(type);
		const elements =
			schema?.snapshot?.element ?? schema?.differential?.element ?? [];
		const prefix = [type, ...path].join(".");
		const direct = elements.filter(
			(element) =>
				element.path?.startsWith(`${prefix}.`) &&
				!element.path.slice(prefix.length + 1).includes("."),
		);
		if (direct.length || !path.length) return direct;
		for (let length = path.length; length > 0; length--) {
			const parentPath = [type, ...path.slice(0, length)].join(".");
			const parent = elements.find((element) => element.path === parentPath);
			const parentType = parent?.type?.[0]?.code;
			if (parentType && parentType !== type)
				return children(parentType, path.slice(length));
		}
		return [];
	};
	return async (context: CompletionContext) => {
		const node = parser
			.parse(context.state.doc.toString())
			.resolveInner(context.pos, -1);
		if (["String", "LineComment", "BlockComment"].includes(node.name))
			return null;
		const token = context.matchBefore(
			/%(?:`[^`]+`|[A-Za-z0-9_-]+)\.(?:[A-Za-z][A-Za-z0-9]*\.)*[A-Za-z0-9]*/,
		);
		if (!token) return null;
		const match = token.text.match(/^%(?:`([^`]+)`|([A-Za-z0-9_-]+))\.(.*)$/);
		if (!match) return null;
		const variable = variables.find(
			({ name }) => name === (match[1] ?? match[2]),
		);
		if (!variable?.resourceType) return null;
		const path = (match[3] ?? "").split(".");
		const partial = path.pop() ?? "";
		const fields = await children(variable.resourceType, path);
		return {
			from: context.pos - partial.length,
			options: fields.map((element) => ({
				label: (element.path?.split(".").at(-1) ?? "").replace("[x]", ""),
				type: "property",
				detail: element.type?.map(({ code }) => code).join(" | "),
				info: element.definition ?? element.short,
			})),
			validFor: /^[A-Za-z0-9]*$/,
		};
	};
}
