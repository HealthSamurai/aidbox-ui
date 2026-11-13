import type { SyntaxNode } from "@lezer/common";
import { parser } from "lezer-fhirpath";
import {
	fhirpathString,
	fhirpathVariable,
	unquoteFhirpath,
} from "../../shared/fhirpath";

export type ExpressionRange = { from: number; to: number };

/** Reference answer values before any comparison, aggregation, or conversion. */
export function planDefinitionAnswerExpression(
	actionId: string,
	linkId?: string,
): string {
	const selector =
		linkId === undefined ? "" : `.where(linkId = ${fhirpathString(linkId)})`;
	return `${fhirpathVariable(actionId)}.repeat(item)${selector}.answer.value`;
}

/** Read item selectors attached to each external variable, ignoring quoted text. */
export function planDefinitionExpressionSources(expression: string) {
	const sources: Array<{
		actionId: string;
		linkId?: string;
		ranges: ExpressionRange[];
	}> = [];
	let invalid = false;
	parser.parse(expression).iterate({
		enter(node) {
			if (node.type.isError) invalid = true;
			if (node.name !== "ExternalConstant") return;
			const identifier =
				node.node.getChild("Identifier") ?? node.node.getChild("String");
			if (!identifier) return;
			const value = expression.slice(identifier.from, identifier.to);
			const actionId = /^[`']/.test(value) ? unquoteFhirpath(value) : value;
			const selectors = new Map<string, ExpressionRange[]>();
			const readSelectors = (part: SyntaxNode) => {
				// A nested invocation has its own context, possibly another form.
				if (part.name === "InvocationExpression") return;
				if (part.name === "EqualityExpression") {
					const field = part.firstChild;
					const literal = part.lastChild?.getChild("String");
					if (
						field?.name === "Identifier" &&
						expression.slice(field.from, field.to) === "linkId" &&
						part.getChild("=") &&
						literal
					) {
						const linkId = unquoteFhirpath(
							expression.slice(literal.from, literal.to),
						);
						selectors.set(linkId, [
							...(selectors.get(linkId) ?? []),
							{ from: part.from, to: part.to },
						]);
					}
				}
				for (let child = part.firstChild; child; child = child.nextSibling)
					readSelectors(child);
			};
			let end = node.to;
			let invocation = node.node.parent;
			while (
				invocation?.name === "InvocationExpression" &&
				invocation.from === node.from
			) {
				end = invocation.to;
				const fn = invocation.lastChild;
				const previous = invocation.firstChild?.lastChild;
				// The edge represents the answer source, not operations on its values.
				if (
					fn?.name === "Identifier" &&
					expression.slice(fn.from, fn.to) === "value" &&
					previous?.name === "Identifier" &&
					expression.slice(previous.from, previous.to) === "answer"
				)
					break;
				const name = fn?.getChild("Identifier");
				if (
					fn?.name === "Function" &&
					name &&
					expression.slice(name.from, name.to) === "where"
				)
					readSelectors(fn);
				invocation = invocation.parent;
			}
			const ranges = [{ from: node.from, to: end }];
			sources.push(
				...(selectors.size
					? [...selectors].map(([linkId, selectorRanges]) => ({
							actionId,
							linkId,
							ranges: selectors.size > 1 ? selectorRanges : ranges,
						}))
					: [{ actionId, ranges }]),
			);
		},
	});
	return invalid ? [] : sources;
}

/** Locate every occurrence represented by an edge, preserving the editor's whitespace. */
export function planDefinitionExpressionSourceRanges(
	expression: string,
	actionId: string,
	linkId?: string,
): ExpressionRange[] {
	return planDefinitionExpressionSources(expression)
		.filter(
			(source) => source.actionId === actionId && source.linkId === linkId,
		)
		.flatMap((source) => source.ranges);
}
