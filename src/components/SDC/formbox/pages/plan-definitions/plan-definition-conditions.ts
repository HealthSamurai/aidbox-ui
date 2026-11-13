import type {
	PlanDefinitionActionCondition,
	QuestionnaireItem,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type { SyntaxNode } from "@lezer/common";
import { parser } from "lezer-fhirpath";
import {
	compactFhirpath,
	fhirpathString,
	unquoteFhirpath,
} from "../../shared/fhirpath";
import { generateId } from "../../shared/id";
import { planDefinitionAnswerExpression } from "./plan-definition-expressions";
import type { PlanDefinitionQuestion } from "./plan-definition-model";

export type ConditionAnswer = {
	type:
		| "string"
		| "boolean"
		| "integer"
		| "decimal"
		| "date"
		| "dateTime"
		| "time"
		| "coding"
		| "quantity"
		| "reference";
	value: string;
	system?: string;
	display?: string;
};
export type ConditionQuestionRule = {
	kind: "rule";
	id: string;
	actionId: string;
	question: string;
	operator: "exists" | "not-exists" | "=" | "!=" | ">" | "<" | ">=" | "<=";
	answer?: ConditionAnswer;
};
export type ConditionFormRule = {
	kind: "form";
	id: string;
	actionId: string;
	operator: "exists" | "not-exists";
};
export type ConditionRule = ConditionQuestionRule | ConditionFormRule;
export type ConditionGroup = {
	kind: "group";
	id: string;
	behavior: "all" | "any";
	/** Keep a user-created group and its two slots when conditions are removed. */
	explicit?: boolean;
	children: ConditionNode[];
};
/** An unchosen condition slot in the visual editor, never a runtime rule. */
export type ConditionPlaceholder = { kind: "placeholder"; id: string };
export type ConditionNode =
	| ConditionRule
	| ConditionGroup
	| ConditionPlaceholder;
export type ConditionEditorDraft = {
	mode: "rules" | "expression";
	rules?: ConditionGroup;
};

export const conditionOperators = [
	{ value: "=", label: "equals" },
	{ value: "!=", label: "does not equal" },
	{ value: ">", label: "is greater than" },
	{ value: "<", label: "is less than" },
	{ value: ">=", label: "is greater than or equal to" },
	{ value: "<=", label: "is less than or equal to" },
	{ value: "exists", label: "has an answer" },
	{ value: "not-exists", label: "has no answer" },
] as const;

export const formConditionOperators = [
	{ value: "exists", label: "has any answers" },
	{ value: "not-exists", label: "has no answers" },
] as const;

export function newConditionGroup(): ConditionGroup {
	return {
		kind: "group",
		id: generateId(),
		behavior: "all",
		children: [],
	};
}

export function newConditionRule(): ConditionQuestionRule {
	return {
		kind: "rule",
		id: generateId(),
		actionId: "",
		question: "",
		operator: "=",
	};
}

export function newFormConditionRule(): ConditionFormRule {
	return { kind: "form", id: generateId(), actionId: "", operator: "exists" };
}

export function newConditionPlaceholder(): ConditionPlaceholder {
	return { kind: "placeholder", id: generateId() };
}

/** Match the question's answer control, including non-coded answer options. */
export function conditionAnswerType(
	item: QuestionnaireItem,
): ConditionAnswer["type"] {
	const type = item.type;
	if (type === "choice" || type === "open-choice") {
		const option = item.answerOption?.[0];
		if (option?.valueString !== undefined) return "string";
		if (option?.valueInteger !== undefined) return "integer";
		if (option?.valueDate !== undefined) return "date";
		if (option?.valueTime !== undefined) return "time";
		if (option?.valueReference !== undefined) return "reference";
		return "coding";
	}
	return ["text", "url", "attachment", "question", "group", "display"].includes(
		type,
	)
		? "string"
		: (type as ConditionAnswer["type"]);
}

export function operatorsForQuestion(item?: QuestionnaireItem) {
	if (item?.type === "attachment")
		return conditionOperators.filter((operator) =>
			operator.value.includes("exists"),
		);
	const ordered =
		item &&
		["integer", "decimal", "quantity", "date", "dateTime", "time"].includes(
			conditionAnswerType(item),
		);
	return conditionOperators.filter(
		(operator) =>
			ordered || ["=", "!=", "exists", "not-exists"].includes(operator.value),
	);
}

/** Compile complete rules only; unfinished controls remain in the editor draft. */
export function conditionExpression(rule: ConditionNode): string | undefined {
	if (rule.kind === "placeholder") return undefined;
	if (rule.kind === "group") {
		const expressions = rule.children
			.map(conditionExpression)
			.filter((value): value is string => Boolean(value));
		return expressions.length > 1
			? expressions
					.map((expression) => `(${expression})`)
					.join(rule.behavior === "all" ? " and " : " or ")
			: expressions[0];
	}
	if (!rule.actionId) return undefined;
	if (rule.kind === "form")
		return `${planDefinitionAnswerExpression(rule.actionId)}.${rule.operator === "exists" ? "exists" : "empty"}()`;
	if (!rule.question) return undefined;
	const path = planDefinitionAnswerExpression(rule.actionId, rule.question);
	if (rule.operator === "exists") return `${path}.exists()`;
	if (rule.operator === "not-exists") return `${path}.empty()`;
	const answer = rule.answer;
	if (!answer?.value.trim()) return undefined;
	let predicate: string;
	if (answer.type === "coding") {
		const coding = `code = ${fhirpathString(answer.value)}${answer.system ? ` and system = ${fhirpathString(answer.system)}` : ""}`;
		predicate = rule.operator === "!=" ? `(${coding}).not()` : coding;
	} else {
		const literal = conditionLiteral(answer);
		if (!literal) return undefined;
		const target =
			answer.type === "quantity"
				? "value"
				: answer.type === "reference"
					? "reference"
					: "$this";
		predicate = `${target} ${rule.operator} ${literal}`;
	}
	// Comparing within where keeps repeated answers and an unanswered question boolean-valued.
	return `${path}.where(${predicate}).exists()`;
}

/** Unlike compilation, completion requires every nested condition to be filled. */
export function isConditionComplete(condition: ConditionNode): boolean {
	return condition.kind === "group"
		? condition.children.length > 0 &&
				condition.children.every(isConditionComplete)
		: Boolean(conditionExpression(condition));
}

function conditionLiteral(answer: ConditionAnswer): string | undefined {
	switch (answer.type) {
		case "boolean":
			return ["true", "false"].includes(answer.value)
				? answer.value
				: undefined;
		case "integer":
		case "decimal":
		case "quantity":
			return /^-?\d+(?:\.\d+)?$/.test(answer.value) &&
				Number.isFinite(Number(answer.value)) &&
				(answer.type !== "integer" || Number.isInteger(Number(answer.value)))
				? answer.value
				: undefined;
		case "date":
		case "dateTime":
			return /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(answer.value)
				? `@${answer.value}`
				: undefined;
		case "time":
			return /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(answer.value)
				? `@T${answer.value}`
				: undefined;
		default:
			return fhirpathString(answer.value);
	}
}

/** Read the visual subset without replacing expressions with unsupported syntax. */
export function parseConditions(
	conditions: PlanDefinitionActionCondition[] = [],
	questions: PlanDefinitionQuestion[],
	actionIds: string[] = questions.map((question) => question.actionId),
): ConditionGroup | undefined {
	const group = newConditionGroup();
	for (const condition of conditions) {
		if (
			condition.kind !== "applicability" ||
			condition.expression?.language !== "text/fhirpath"
		)
			return undefined;
		const expression = condition.expression.expression ?? "";
		if (!expression.trim()) continue;
		const tree = parser.parse(expression);
		let invalid = false;
		tree.iterate({
			enter(node) {
				if (node.type.isError) invalid = true;
			},
		});
		if (invalid) return undefined;
		const rule = parseConditionNodes(
			syntaxChildren(tree.topNode),
			expression,
			questions,
			actionIds,
		);
		if (!rule) return undefined;
		group.children.push(rule);
	}
	return group.children.length === 1 && group.children[0]?.kind === "group"
		? group.children[0]
		: group;
}

function syntaxChildren(node: SyntaxNode): SyntaxNode[] {
	const children: SyntaxNode[] = [];
	for (let child = node.firstChild; child; child = child.nextSibling)
		if (!["LineComment", "BlockComment"].includes(child.name))
			children.push(child);
	return children;
}

function parseConditionNodes(
	nodes: SyntaxNode[],
	expression: string,
	questions: PlanDefinitionQuestion[],
	actionIds: string[],
): ConditionRule | ConditionGroup | undefined {
	if (
		nodes.length === 1 &&
		["AndExpression", "OrExpression"].includes(nodes[0]?.name ?? "")
	)
		return parseConditionNodes(
			syntaxChildren(nodes[0] as SyntaxNode),
			expression,
			questions,
			actionIds,
		);
	const join = nodes.findIndex((node) => ["and", "or"].includes(node.name));
	if (join > 0) {
		const left = parseConditionNodes(
			nodes.slice(0, join),
			expression,
			questions,
			actionIds,
		);
		const right = parseConditionNodes(
			nodes.slice(join + 1),
			expression,
			questions,
			actionIds,
		);
		if (!left || !right) return undefined;
		return {
			...newConditionGroup(),
			behavior: nodes[join]?.name === "and" ? "all" : "any",
			children: [left, right],
		};
	}
	if (nodes[0]?.name === "(" && nodes.at(-1)?.name === ")")
		return parseConditionNodes(
			nodes.slice(1, -1),
			expression,
			questions,
			actionIds,
		);
	const first = nodes[0];
	const last = nodes.at(-1);
	if (!first || !last) return undefined;
	const source = expression.slice(first.from, last.to);
	return (
		parseFormConditionRule(source, actionIds) ??
		parseConditionRule(source, questions)
	);
}

const quotedString = "'(?:\\\\.|[^'\\\\])*'";

function parseFormConditionRule(
	expression: string,
	actionIds: string[],
): ConditionFormRule | undefined {
	const compact = compactFhirpath(expression);
	const match = compact?.match(
		new RegExp(
			`^%([A-Za-z_][A-Za-z0-9_]*|\x60[^\x60]+\x60|${quotedString})\\.repeat\\(item\\)\\.answer\\.value\\.(exists\\(\\)|empty\\(\\)|exists\\(\\)\\.not\\(\\))$`,
		),
	);
	if (!match) return undefined;
	const variable = match[1] ?? "";
	const actionId = /^[`']/.test(variable)
		? unquoteFhirpath(variable)
		: variable;
	if (!actionIds.includes(actionId)) return undefined;
	return {
		...newFormConditionRule(),
		actionId,
		operator: match[2] === "exists()" ? "exists" : "not-exists",
	};
}

function parseConditionRule(
	expression: string,
	questions: PlanDefinitionQuestion[],
): ConditionRule | undefined {
	const compact = compactFhirpath(expression);
	if (!compact) return undefined;
	const match = compact.match(
		new RegExp(
			`^%([A-Za-z_][A-Za-z0-9_]*|\x60[^\x60]+\x60|${quotedString})\\.repeat\\(item(?:\\|answer\\.item)?\\)\\.where\\(linkId=(${quotedString})\\)\\.answer\\.(value[A-Za-z]*)(.*)$`,
		),
	);
	if (!match) return undefined;
	const [, variable = "", questionLiteral = "", valueField = "", tail = ""] =
		match;
	const actionId = /^[`']/.test(variable)
		? unquoteFhirpath(variable)
		: variable;
	const question = unquoteFhirpath(questionLiteral);
	const source = questions.find(
		(source) => source.actionId === actionId && source.item.linkId === question,
	);
	if (!source) return undefined;
	const type = conditionAnswerType(source.item);
	const fieldType =
		source.item.type === "url" ? "Uri" : type[0]?.toUpperCase() + type.slice(1);
	if (valueField !== "value" && valueField !== `value${fieldType}`)
		return undefined;
	const rule: ConditionRule = { ...newConditionRule(), actionId, question };
	let suffix = tail;
	if (suffix === ".exists()") return { ...rule, operator: "exists" };
	if ([".empty()", ".exists().not()"].includes(suffix))
		return { ...rule, operator: "not-exists" };
	if (suffix.startsWith(".where(") && suffix.endsWith(").exists()"))
		suffix = suffix.slice(7, -10);
	const coding = suffix.match(
		new RegExp(
			`^(\\()?code=(${quotedString})(?:andsystem=(${quotedString}))?(\\)\\.not\\(\\))?$`,
		),
	);
	if (coding && type === "coding" && Boolean(coding[1]) === Boolean(coding[4]))
		return {
			...rule,
			operator: coding[1] ? "!=" : "=",
			answer: {
				type: "coding",
				value: unquoteFhirpath(coding[2] ?? ""),
				...(coding[3] && { system: unquoteFhirpath(coding[3]) }),
			},
		};
	const comparison = suffix.match(
		/^(\$this|\.?value|\.?reference|\.?code)?(>=|<=|!=|=|>|<)(.+)$/,
	);
	if (!comparison) return undefined;
	const operator = comparison[2] as ConditionRule["operator"];
	if (
		!operatorsForQuestion(source.item).some(
			(candidate) => candidate.value === operator,
		)
	)
		return undefined;
	const literal = comparison[3] ?? "";
	const literalPatterns: Record<ConditionAnswer["type"], RegExp> = {
		string: new RegExp(`^${quotedString}$`),
		coding: new RegExp(`^${quotedString}$`),
		reference: new RegExp(`^${quotedString}$`),
		boolean: /^(true|false)$/,
		integer: /^-?\d+$/,
		decimal: /^-?\d+(?:\.\d+)?$/,
		quantity: /^-?\d+(?:\.\d+)?$/,
		date: /^@\d{4}-\d{2}-\d{2}$/,
		dateTime: /^@\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/,
		time: /^@T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/,
	};
	if (!literalPatterns[type].test(literal)) return undefined;
	const value = literal.startsWith("'")
		? unquoteFhirpath(literal)
		: literal.replace(/^@T?/, "");
	const answer: ConditionAnswer = { type, value };
	const targets: Partial<Record<ConditionAnswer["type"], string[]>> = {
		coding: [".code"],
		quantity: ["value", ".value"],
		reference: ["reference", ".reference"],
	};
	if (!(targets[type] ?? ["$this", ""]).includes(comparison[1] ?? ""))
		return undefined;
	if (!conditionLiteral(answer)) return undefined;
	// A date-time with an explicit time zone needs raw editing to retain that zone.
	if (type === "dateTime" && /(?:Z|[+-]\d\d:\d\d)$/.test(value))
		return undefined;
	return { ...rule, operator, answer };
}
