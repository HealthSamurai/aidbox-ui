import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import { sdcRequest } from "@aidbox-ui/components/Forms/api/plan-definitions";
import type { FhirpathVariable } from "@aidbox-ui/components/Forms/editor/fhirpath-editor";
import { useOperationOutcomeError } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import { ResourceSearchSelect } from "@aidbox-ui/components/Forms/share/resource-search-select";
import type {
	PlanDefinitionActionCondition,
	QuestionnaireItem,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { generateId } from "@aidbox-ui/utils";
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	IconButton,
	inputVariants,
	Select,
	SelectTrigger,
	SelectValue,
	Skeleton,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ConditionExpressionEditor } from "./plan-definition-condition-expression-editor";
import {
	type ConditionAnswer,
	type ConditionGroup,
	type ConditionRule,
	conditionAnswerType,
	formConditionOperators,
	isConditionComplete,
	newConditionGroup,
	newConditionPlaceholder,
	newConditionRule,
	newFormConditionRule,
	operatorsForQuestion,
} from "./plan-definition-conditions";
import type {
	PlanDefinitionActionDraft,
	PlanDefinitionQuestion,
} from "./plan-definition-model";
import { PlanDefinitionQuestionSelect } from "./plan-definition-question-select";
import { conditionRulePaths } from "./plan-definition-rule-highlight";

const inlineSelectClassName =
	"h-8 w-fit min-w-0 max-w-full gap-1.5 px-2 py-0 text-sm";
const inlineInputClassName = cn(
	inputVariants(),
	"h-8 w-auto min-w-16 max-w-full px-2 py-0 text-sm md:text-sm [field-sizing:content]",
);

/** Edit availability using questionnaire-style rules or unrestricted FHIRPath. */
export function PlanDefinitionConditionEditor({
	action,
	mode,
	rules,
	questions,
	actions,
	loading,
	loadError,
	onRetry,
	compiledConditions,
	variables,
	errors,
	actionPath,
	actionIndex,
	onChange,
}: {
	action: PlanDefinitionActionDraft;
	mode: "rules" | "expression";
	rules?: ConditionGroup;
	questions: PlanDefinitionQuestion[];
	actions: PlanDefinitionActionDraft[];
	loading: boolean;
	loadError: boolean;
	onRetry: () => void;
	compiledConditions?: PlanDefinitionActionCondition[];
	variables: FhirpathVariable[];
	errors: Record<string, string>;
	actionPath: string;
	actionIndex?: number;
	onChange: (action: PlanDefinitionActionDraft) => void;
}) {
	const [emptyCondition] = useState<PlanDefinitionActionCondition>(() => ({
		id: generateId(),
		kind: "applicability",
		expression: { language: "text/fhirpath", expression: "" },
	}));
	const conditions = action.condition?.length
		? action.condition
		: [emptyCondition];
	const ruleError = useOperationOutcomeError(
		mode === "rules" && actionIndex !== undefined
			? new RegExp(
					`^PlanDefinition\\.action\\[${actionIndex}\\]\\.condition(?:\\.|\\[|$)`,
				)
			: undefined,
	);
	const updateRules = (rules: ConditionGroup) =>
		onChange({ ...action, conditionEditor: { mode: "rules", rules } });
	return (
		<section className="space-y-3" aria-label="Enable when">
			{mode === "rules" && rules ? (
				<>
					{loading && <Skeleton className="h-8" />}
					{loadError && (
						<p className="text-xs text-text-secondary">
							Could not load questions.{" "}
							<Button size="small" variant="link" onClick={onRetry}>
								Retry
							</Button>
						</p>
					)}
					<ConditionGroupEditor
						group={rules}
						questions={questions}
						actions={actions}
						currentActionId={action.id}
						rulePaths={conditionRulePaths(
							rules,
							compiledConditions ?? action.condition ?? [],
							actionPath,
						)}
						onChange={updateRules}
						error={
							ruleError ??
							[
								...new Set(
									(compiledConditions ?? [])
										.map(
											(condition, index) =>
												errors[
													`${actionPath}.condition.${condition.id ?? index}`
												],
										)
										.filter(Boolean),
								),
							].join(" ")
						}
					/>
				</>
			) : (
				<>
					{!rules && !loading && (
						<p className="text-xs text-text-secondary">
							This expression uses features outside the condition builder.
						</p>
					)}
					{conditions.map((condition, index) => {
						const serializedIndex =
							compiledConditions?.findIndex(
								(value) => value.id === condition.id,
							) ?? -1;
						return (
							<ConditionExpressionEditor
								key={condition.id}
								condition={condition}
								index={index}
								rulePath={`${actionPath}.condition.${condition.id ?? index}`}
								issuePattern={
									actionIndex !== undefined && serializedIndex >= 0
										? new RegExp(
												`^PlanDefinition\\.action\\[${actionIndex}\\]\\.condition\\[${serializedIndex}\\](?:\\.|\\[|$)`,
											)
										: undefined
								}
								error={
									errors[`${actionPath}.condition.${condition.id ?? index}`]
								}
								variables={variables}
								onChange={(expression) =>
									onChange({
										...action,
										conditionEditor: { mode: "expression" },
										condition: conditions.map((rule, position) =>
											position === index
												? {
														...rule,
														expression: {
															...rule.expression,
															language: "text/fhirpath",
															expression,
														},
													}
												: rule,
										),
									})
								}
								onRemove={
									conditions.length > 1
										? () =>
												onChange({
													...action,
													conditionEditor: { mode: "expression" },
													condition: conditions.filter(
														(_, position) => position !== index,
													),
												})
										: undefined
								}
							/>
						);
					})}
				</>
			)}
		</section>
	);
}

function ConditionGroupEditor({
	group,
	questions,
	actions,
	currentActionId,
	rulePaths,
	onChange,
	onRemove,
	error,
	depth = 0,
}: {
	group: ConditionGroup;
	questions: PlanDefinitionQuestion[];
	actions: PlanDefinitionActionDraft[];
	currentActionId?: string;
	rulePaths: Record<string, string>;
	onChange: (group: ConditionGroup) => void;
	onRemove?: () => void;
	error?: string;
	depth?: number;
}) {
	const errorId = useId();
	const combined = group.children.length > 1;
	const hasPlaceholders = group.children.some(
		(child) => child.kind === "placeholder",
	);
	const keepSlots = group.explicit || hasPlaceholders;
	// The unbracketed root holds one expression; add further rules inside a group.
	const canAddCondition =
		(depth > 0 || combined || group.children.length === 0) &&
		group.children.every(isConditionComplete);
	// Each row draws its share of the bracket so nested groups and wrapped
	// conditions anchor at their centers without assuming a fixed row height.
	const rowClassName = cn(
		"relative min-w-0",
		combined &&
			"before:pointer-events-none before:absolute before:-inset-y-1 before:-left-8 before:w-6 before:border-l before:border-border-primary first:before:top-1/2 first:before:rounded-tl-md first:before:border-t last:before:bottom-1/2 last:before:rounded-bl-md last:before:border-b",
	);
	const removeGroup =
		onRemove ?? (() => onChange({ ...group, explicit: false, children: [] }));
	const addCondition = (next: ConditionRule | ConditionGroup) => {
		// An empty root is already the expression's group; avoid an extra wrapper.
		onChange(
			depth === 0 && group.children.length === 0 && next.kind === "group"
				? { ...next, id: group.id }
				: { ...group, children: [...group.children, next] },
		);
	};
	return (
		<fieldset
			className="min-w-0 space-y-2"
			aria-label="Condition group"
			aria-invalid={Boolean(error)}
			aria-describedby={error ? errorId : undefined}
			data-test-id="plan-definition-conditions__group"
			data-condition-group-id={group.id}
		>
			<div
				className={cn(
					"relative min-w-0",
					combined ? "pl-21" : onRemove && "pl-8",
				)}
			>
				{(combined || onRemove) && (
					<div className="absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center">
						<IconButton
							className="size-8"
							variant="ghost"
							aria-label="Remove condition group"
							title="Remove condition group"
							data-test-id="plan-definition-conditions__remove-group-button"
							onClick={removeGroup}
							icon={<Trash2 className="size-4" />}
						/>
						{combined && (
							<Button
								variant="ghost"
								size="small"
								className="w-10 rounded-md bg-bg-primary"
								aria-label={
									group.behavior === "all"
										? "Match all conditions (AND)"
										: "Match any condition (OR)"
								}
								title={
									group.behavior === "all"
										? "All conditions must be true. Switch to OR."
										: "Any condition can be true. Switch to AND."
								}
								data-test-id="plan-definition-conditions__group-operator-button"
								onClick={() =>
									onChange({
										...group,
										behavior: group.behavior === "all" ? "any" : "all",
									})
								}
							>
								{group.behavior === "all" ? "AND" : "OR"}
							</Button>
						)}
					</div>
				)}
				<div className="flex min-w-0 flex-col gap-2">
					{group.children.map((rule, index) => {
						const update = (next: ConditionRule | ConditionGroup) => {
							const children = group.children.map((value, position) =>
								position === index ? next : value,
							);
							onChange({ ...group, explicit: keepSlots, children });
						};
						const remove = () => {
							const children = group.children.filter(
								(_, position) => position !== index,
							);
							if (keepSlots && children.length < 2)
								children.push(newConditionPlaceholder());
							onChange({ ...group, explicit: keepSlots, children });
						};
						return (
							<div
								key={rule.id}
								className={rowClassName}
								data-test-id="plan-definition-conditions__group-row"
							>
								{rule.kind === "placeholder" ? (
									<AddConditionMenu depth={depth} onAdd={update} />
								) : rule.kind === "group" ? (
									<ConditionGroupEditor
										group={rule}
										questions={questions}
										actions={actions}
										currentActionId={currentActionId}
										rulePaths={rulePaths}
										depth={depth + 1}
										onChange={update}
										onRemove={remove}
									/>
								) : (
									<ConditionRuleEditor
										rule={rule}
										questions={questions}
										actions={actions}
										currentActionId={currentActionId}
										rulePath={rulePaths[rule.id]}
										onChange={update}
										onRemove={remove}
									/>
								)}
							</div>
						);
					})}
					{canAddCondition && (
						<div
							className={rowClassName}
							data-test-id="plan-definition-conditions__group-row"
						>
							<AddConditionMenu depth={depth} onAdd={addCondition} />
						</div>
					)}
				</div>
			</div>
			{error && (
				<p
					id={errorId}
					role="alert"
					className="text-xs text-text-error-primary"
				>
					{error}
				</p>
			)}
		</fieldset>
	);
}

function AddConditionMenu({
	depth,
	onAdd,
}: {
	depth: number;
	onAdd: (condition: ConditionRule | ConditionGroup) => void;
}) {
	const addGroup = (behavior: ConditionGroup["behavior"]) =>
		onAdd({
			...newConditionGroup(),
			behavior,
			explicit: true,
			children: [newConditionPlaceholder(), newConditionPlaceholder()],
		});
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="secondary"
					className="h-8 w-fit px-3"
					data-test-id="plan-definition-editor__add-condition-button"
				>
					<Plus className="size-4" />
					Add condition
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuItem
					onClick={() => onAdd({ ...newConditionRule(), operator: "exists" })}
				>
					When a question has an answer
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onAdd(newConditionRule())}>
					When a question matches an answer
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onAdd(newFormConditionRule())}>
					When a form has answers
				</DropdownMenuItem>
				{depth < 2 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => addGroup("all")}>
							When every condition is met
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => addGroup("any")}>
							When any condition is met
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ConditionRuleEditor({
	rule,
	questions,
	actions,
	currentActionId,
	rulePath,
	onChange,
	onRemove,
}: {
	rule: ConditionRule;
	questions: PlanDefinitionQuestion[];
	actions: PlanDefinitionActionDraft[];
	currentActionId?: string;
	rulePath?: string;
	onChange: (rule: ConditionRule) => void;
	onRemove: () => void;
}) {
	const source =
		rule.kind === "rule"
			? questions.find(
					(question) =>
						question.actionId === rule.actionId &&
						question.item.linkId === rule.question,
				)
			: undefined;
	const formOptions = actions.flatMap((action, index) =>
		action.id
			? [
					{
						id: action.id,
						title: action.title || action.id,
						index,
					},
				]
			: [],
	);
	const options =
		rule.kind === "form"
			? formConditionOperators
			: operatorsForQuestion(source?.item);
	const exists = rule.operator.includes("exists");
	return (
		<fieldset
			className="plan-definition-rule-highlight-row flex min-w-0 items-start gap-2"
			aria-label="Condition"
			data-test-id="plan-definition-conditions__rule-row"
			data-rule-path={rulePath}
			data-source-action-id={rule.actionId}
			data-source-link-id={rule.kind === "rule" ? rule.question : undefined}
		>
			<IconButton
				variant="ghost"
				className="size-8 shrink-0"
				aria-label="Remove condition"
				title="Remove condition"
				onClick={onRemove}
				icon={<Trash2 className="size-4" />}
			/>
			<div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-primary">
				<span className="whitespace-nowrap">
					When {rule.kind === "form" ? "form" : "question"}
				</span>
				{rule.kind === "form" ? (
					<ResourceSearchSelect
						inline
						items={formOptions.filter((form) => form.id !== currentActionId)}
						selectedItem={formOptions.find((form) => form.id === rule.actionId)}
						getKey={(form) => form.id}
						getLabel={(form) => `${form.index + 1}: ${form.title}`}
						placeholder={rule.actionId || "Choose a form"}
						searchPlaceholder="Search forms..."
						testId="plan-definition-conditions__form"
						onSelect={(form) => onChange({ ...rule, actionId: form.id })}
					/>
				) : (
					<PlanDefinitionQuestionSelect
						items={questions.filter(
							(question) => question.actionId !== currentActionId,
						)}
						selectedItem={source}
						placeholder={
							rule.question
								? `${rule.actionId} · ${rule.question}`
								: "Choose a question"
						}
						searchPlaceholder="Search forms and questions..."
						onQueryChange={() => {}}
						testId="plan-definition-conditions__question"
						onSelect={(source) =>
							onChange({
								...rule,
								actionId: source.actionId,
								question: source.item.linkId,
								operator: operatorsForQuestion(source.item).some(
									({ value }) => value === rule.operator,
								)
									? rule.operator
									: source.item.type === "attachment"
										? "exists"
										: "=",
								answer: { type: conditionAnswerType(source.item), value: "" },
							})
						}
					/>
				)}
				<Select
					value={rule.operator}
					onValueChange={(operator: ConditionRule["operator"]) => {
						if (rule.kind === "rule") onChange({ ...rule, operator });
						else if (operator === "exists" || operator === "not-exists")
							onChange({ ...rule, operator });
					}}
				>
					<SelectTrigger
						className={inlineSelectClassName}
						aria-label="Condition operator"
					>
						<SelectValue />
					</SelectTrigger>
					<AppSelectContent>
						{options.map((operator) => (
							<AppSelectItem key={operator.value} value={operator.value}>
								{operator.label}
							</AppSelectItem>
						))}
					</AppSelectContent>
				</Select>
				{rule.kind === "rule" && !exists && source && (
					<ConditionValueEditor
						item={source.item}
						answer={
							rule.answer ?? {
								type: conditionAnswerType(source.item),
								value: "",
							}
						}
						onChange={(answer) => onChange({ ...rule, answer })}
					/>
				)}
			</div>
		</fieldset>
	);
}

function ConditionValueEditor({
	item,
	answer,
	onChange,
}: {
	item: QuestionnaireItem;
	answer: ConditionAnswer;
	onChange: (answer: ConditionAnswer) => void;
}) {
	if (item.answerOption?.length) {
		const options = item.answerOption.map((option): ConditionAnswer => {
			if (option.valueCoding)
				return {
					type: "coding",
					value: option.valueCoding.code ?? "",
					system: option.valueCoding.system,
					display: option.valueCoding.display,
				};
			if (option.valueReference)
				return {
					type: "reference",
					value: option.valueReference.reference ?? "",
					display: option.valueReference.display,
				};
			if (option.valueInteger !== undefined)
				return { type: "integer", value: String(option.valueInteger) };
			if (option.valueDate) return { type: "date", value: option.valueDate };
			if (option.valueTime) return { type: "time", value: option.valueTime };
			return { type: "string", value: option.valueString ?? "" };
		});
		return (
			<ResourceSearchSelect
				inline
				items={options}
				selectedItem={
					options.find(
						(option) =>
							option.value === answer.value &&
							option.system === answer.system &&
							option.type === answer.type,
					) ?? (answer.value ? answer : undefined)
				}
				getKey={(option) =>
					JSON.stringify([option.type, option.system, option.value])
				}
				getLabel={(option) => option.display || option.value}
				onSelect={onChange}
				onQueryChange={() => {}}
				placeholder="Choose an answer"
				searchPlaceholder="Search answers..."
				testId="plan-definition-conditions__answer"
			/>
		);
	}
	if (item.answerValueSet)
		return (
			<ConditionValueSetEditor
				item={item}
				answer={answer}
				onChange={onChange}
			/>
		);
	if (answer.type === "boolean")
		return (
			<Select
				value={answer.value || undefined}
				onValueChange={(value) => onChange({ ...answer, value })}
			>
				<SelectTrigger
					className={inlineSelectClassName}
					aria-label="Condition answer"
				>
					<SelectValue placeholder="Choose an answer" />
				</SelectTrigger>
				<AppSelectContent>
					<AppSelectItem value="true">True</AppSelectItem>
					<AppSelectItem value="false">False</AppSelectItem>
				</AppSelectContent>
			</Select>
		);
	const inputTypes: Partial<Record<ConditionAnswer["type"], string>> = {
		integer: "number",
		decimal: "number",
		quantity: "number",
		date: "date",
		dateTime: "datetime-local",
		time: "time",
	};
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			<input
				aria-label="Condition answer"
				placeholder={
					answer.type === "coding"
						? "Code"
						: answer.type === "reference"
							? "Resource/id"
							: "Answer"
				}
				type={inputTypes[answer.type] ?? "text"}
				step={answer.type === "integer" ? "1" : "any"}
				className={inlineInputClassName}
				value={answer.value}
				onChange={(event) => onChange({ ...answer, value: event.target.value })}
			/>
			{answer.type === "coding" && (
				<input
					aria-label="Code system"
					placeholder="Code system (optional)"
					className={inlineInputClassName}
					value={answer.system ?? ""}
					onChange={(event) =>
						onChange({ ...answer, system: event.target.value })
					}
				/>
			)}
		</div>
	);
}

type ValueSetExpansionContains = {
	code?: string;
	system?: string;
	display?: string;
	abstract?: boolean;
	contains?: ValueSetExpansionContains[];
};

function ConditionValueSetEditor({
	item,
	answer,
	onChange,
}: {
	item: QuestionnaireItem;
	answer: ConditionAnswer;
	onChange: (answer: ConditionAnswer) => void;
}) {
	const [query, setQuery] = useState("");
	const endpoint = (
		item as QuestionnaireItem & {
			extension?: Array<{ url: string; valueUrl?: string }>;
		}
	).extension?.find(
		(extension) =>
			extension.url ===
			"http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer",
	)?.valueUrl;
	const aidboxClient = useAidboxClient();
	const expansion = useQuery({
		queryKey: ["condition-valueset", item.answerValueSet, endpoint, query],
		queryFn: ({ signal }) =>
			sdcRequest<{
				expansion?: { contains?: ValueSetExpansionContains[] };
			}>(
				aidboxClient,
				`/sdc/ValueSet/$expand?${new URLSearchParams({ url: item.answerValueSet ?? "", filter: query, count: "50" })}`,
				{
					signal,
					...(endpoint && { headers: { "sdc-target-endpoint": endpoint } }),
				},
			),
	});
	const flatten = (
		items: ValueSetExpansionContains[] = [],
	): ConditionAnswer[] =>
		items.flatMap((item) => [
			...(item.code && !item.abstract
				? [
						{
							type: "coding" as const,
							value: item.code,
							system: item.system,
							display: item.display,
						},
					]
				: []),
			...flatten(item.contains),
		]);
	return (
		<ResourceSearchSelect
			inline
			items={flatten(expansion.data?.expansion?.contains)}
			selectedItem={answer.value ? answer : undefined}
			getKey={(answer) => JSON.stringify([answer.system, answer.value])}
			getLabel={(answer) => answer.display || answer.value}
			isLoading={expansion.isPending}
			emptyText={
				expansion.isError
					? "Could not load answers. Try searching again."
					: "No matching answers."
			}
			onQueryChange={setQuery}
			onSelect={onChange}
			placeholder="Choose an answer"
			searchPlaceholder="Search answers..."
			testId="plan-definition-conditions__answer"
		/>
	);
}
