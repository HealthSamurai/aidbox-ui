import type { PlanDefinition } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import {
	Checkbox,
	Input,
	Label,
	ResizableHandle,
	ResizablePanel,
	Select,
	SelectTrigger,
	SelectValue,
	Tabs,
	TabsList,
	TabsTrigger,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { CircleAlert } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { AppSelectContent, AppSelectItem } from "../../../shared/app-select";
import {
	useOperationOutcomeError,
	useOperationOutcomeIssues,
} from "../../shared/operation-outcome-context";

import {
	PlanDefinitionFieldError,
	planDefinitionFieldAttributes,
} from "./plan-definition-fields";
import {
	generatePlanDefinitionUrl,
	type PlanDefinitionActionDraft,
	type PlanDefinitionDraft,
} from "./plan-definition-model";
import type { PlanDefinitionAdvancedMode } from "./plan-definition-rule-modes";

export function PlanDefinitionPropertiesPanel({
	open,
	children,
}: {
	open: boolean;
	children: ReactNode;
}) {
	if (!open) return null;
	return (
		<>
			<ResizableHandle className="hover:border-border-brand hover:bg-border-brand" />
			<ResizablePanel
				id="plan-definition-properties"
				order={2}
				defaultSize={35}
				minSize={20}
				maxSize={70}
			>
				{children}
			</ResizablePanel>
		</>
	);
}

export function PlanDefinitionProperties({
	panelRef,
	action,
	actionIndex,
	tab,
	onTabChange,
	disabled,
	errorTabs,
	advancedMode,
	children,
}: {
	panelRef: RefObject<HTMLElement | null>;
	action?: PlanDefinitionActionDraft;
	actionIndex?: number;
	tab: string;
	onTabChange: (tab: string) => void;
	disabled: boolean;
	errorTabs: Set<string>;
	advancedMode?: PlanDefinitionAdvancedMode;
	children: ReactNode;
}) {
	const severity = ["error", "fatal"] as const;
	const settingsIssues = useOperationOutcomeIssues(
		actionIndex === undefined
			? /^PlanDefinition(?:$|\.(?!action(?:\.|\[|$)))/
			: new RegExp(
					`^PlanDefinition\\.action\\[${actionIndex}\\](?:$|\\.(?!(?:condition|extension)(?:\\.|\\[|$)))`,
				),
		{ severity },
	);
	const conditionIssues = useOperationOutcomeIssues(
		actionIndex === undefined
			? /^PlanDefinition\.condition(?:\.|\[|$)/
			: new RegExp(
					`^PlanDefinition\\.action\\[${actionIndex}\\]\\.condition(?:\\.|\\[|$)`,
				),
		{
			severity,
		},
	);
	const prefillIssues = useOperationOutcomeIssues(
		actionIndex === undefined
			? /^PlanDefinition\.extension(?:\.|\[|$)/
			: new RegExp(
					`^PlanDefinition\\.action\\[${actionIndex}\\]\\.extension(?:\\.|\\[|$)`,
				),
		{
			severity,
		},
	);
	const serverErrorTabs: Record<string, boolean> = {
		settings: settingsIssues.length > 0,
		condition: conditionIssues.length > 0,
		prefill: prefillIssues.length > 0,
	};
	const hasErrors = (tab: string) => errorTabs.has(tab) || serverErrorTabs[tab];

	return (
		<section
			ref={panelRef}
			className="flex h-full min-h-0 flex-col bg-bg-primary"
			aria-label="Properties"
			data-test-id="plan-definition-editor__properties-panel"
		>
			<Tabs
				value={action ? tab : "settings"}
				onValueChange={onTabChange}
				className="min-h-0"
			>
				<div className="flex shrink-0 items-center justify-between gap-4 border-b bg-bg-secondary px-4">
					<TabsList aria-label={action ? "Form settings" : "Package settings"}>
						{[
							{ value: "settings", label: "Settings" },
							...(action
								? [
										{ value: "condition", label: "Enable when" },
										{ value: "prefill", label: "Prefill" },
									]
								: []),
						].map(({ value, label }) => (
							<TabsTrigger
								key={value}
								value={value}
								disabled={disabled}
								title={hasErrors(value) ? "Has errors" : undefined}
								data-test-id={`plan-definition-editor__${value}-tab`}
							>
								{label}
								{hasErrors(value) && (
									<CircleAlert
										className="ml-2 size-3.5 text-text-error-primary"
										aria-hidden
									/>
								)}
							</TabsTrigger>
						))}
					</TabsList>
					{advancedMode && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Label className="shrink-0 cursor-pointer text-xs text-text-secondary has-disabled:cursor-not-allowed has-disabled:opacity-50">
									<Checkbox
										size="small"
										checked={advancedMode.checked}
										disabled={disabled || advancedMode.disabled}
										data-test-id={
											tab === "condition"
												? "plan-definition-conditions__advanced-mode-checkbox"
												: "plan-definition-prefill__advanced-mode-checkbox"
										}
										onCheckedChange={(checked) =>
											advancedMode.onChange(Boolean(checked))
										}
									/>
									Advanced mode
								</Label>
							</TooltipTrigger>
							<TooltipContent>
								{advancedMode.description ??
									"Edit the FHIRPath expression directly."}
							</TooltipContent>
						</Tooltip>
					)}
				</div>
				<fieldset
					disabled={disabled}
					className="flex min-h-0 min-w-0 flex-1 flex-col"
				>
					{children}
				</fieldset>
			</Tabs>
		</section>
	);
}

export function PlanDefinitionActionSettings({
	action,
	actionPath,
	actionIndex,
	errors,
	onChange,
}: {
	action: PlanDefinitionActionDraft;
	actionPath: string;
	actionIndex: number;
	errors: Record<string, string>;
	onChange: (action: PlanDefinitionActionDraft) => void;
}) {
	const actionError = useOperationOutcomeError(
		`PlanDefinition.action[${actionIndex}]`,
	);
	const questionnaireError = useOperationOutcomeError(
		`PlanDefinition.action[${actionIndex}].definitionCanonical`,
	);
	const titleError =
		useOperationOutcomeError(`PlanDefinition.action[${actionIndex}].title`) ??
		errors[`${actionPath}.title`];
	const idError =
		useOperationOutcomeError(`PlanDefinition.action[${actionIndex}].id`) ??
		errors[`${actionPath}.id`];
	return (
		<>
			<PlanDefinitionFieldError
				id="action-error"
				message={actionError ?? errors[actionPath]}
			/>
			<PlanDefinitionFieldError
				id="action-questionnaire-error"
				message={
					questionnaireError ?? errors[`${actionPath}.definitionCanonical`]
				}
			/>
			<div className="w-full max-w-sm space-y-4">
				<div className="space-y-1.5">
					<Label htmlFor="action-title">Title</Label>
					<Input
						id="action-title"
						invalid={Boolean(titleError)}
						{...planDefinitionFieldAttributes(titleError, "action-title-error")}
						value={action.title ?? ""}
						onChange={(event) =>
							onChange({
								...action,
								title: event.target.value,
							})
						}
					/>
					<PlanDefinitionFieldError
						id="action-title-error"
						message={titleError}
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="action-id">ID</Label>
					<Input
						id="action-id"
						invalid={Boolean(idError)}
						{...planDefinitionFieldAttributes(idError, "action-id-error")}
						value={action.id ?? ""}
						onChange={(event) =>
							onChange({
								...action,
								id: event.target.value,
							})
						}
					/>
					<PlanDefinitionFieldError id="action-id-error" message={idError} />
				</div>
			</div>
		</>
	);
}

export function PlanDefinitionSettings({
	planDefinition,
	errors,
	automaticUrl,
	urlPrefix,
	setAutomaticUrl,
	onChange,
}: {
	planDefinition: PlanDefinitionDraft;
	errors: Record<string, string>;
	automaticUrl: boolean;
	urlPrefix?: string;
	setAutomaticUrl: (value: boolean) => void;
	onChange: (properties: Partial<Omit<PlanDefinitionDraft, "action">>) => void;
}) {
	const titleError =
		useOperationOutcomeError("PlanDefinition.title") ?? errors.title;
	const versionError =
		useOperationOutcomeError("PlanDefinition.version") ?? errors.version;
	const statusError =
		useOperationOutcomeError("PlanDefinition.status") ?? errors.status;
	const descriptionError =
		useOperationOutcomeError("PlanDefinition.description") ??
		errors.description;
	const urlError = useOperationOutcomeError("PlanDefinition.url") ?? errors.url;
	const publisherError =
		useOperationOutcomeError("PlanDefinition.publisher") ?? errors.publisher;
	return (
		<div className="grid gap-4 md:grid-cols-4">
			<div className="space-y-1.5 md:col-span-2">
				<Label htmlFor="plan-definition-name">Package name</Label>
				<Input
					id="plan-definition-name"
					invalid={Boolean(titleError)}
					{...planDefinitionFieldAttributes(
						titleError,
						"plan-definition-name-error",
					)}
					data-test-id="plan-definition-editor__name-input"
					placeholder="Package name"
					value={planDefinition.title ?? ""}
					onChange={(event) =>
						onChange({
							title: event.target.value,
							...(automaticUrl && {
								url: generatePlanDefinitionUrl(event.target.value, urlPrefix),
							}),
						})
					}
				/>
				<PlanDefinitionFieldError
					id="plan-definition-name-error"
					message={titleError}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="plan-definition-version">Version</Label>
				<Input
					id="plan-definition-version"
					invalid={Boolean(versionError)}
					{...planDefinitionFieldAttributes(
						versionError,
						"plan-definition-version-error",
					)}
					value={planDefinition.version ?? ""}
					onChange={(event) =>
						onChange({
							version: event.target.value,
						})
					}
				/>
				<PlanDefinitionFieldError
					id="plan-definition-version-error"
					message={versionError}
				/>
			</div>
			<div className="space-y-1.5">
				<Label>Status</Label>
				<Select
					value={planDefinition.status}
					onValueChange={(status) =>
						onChange({
							status: status as PlanDefinition["status"],
						})
					}
				>
					<SelectTrigger
						aria-label="Package status"
						{...planDefinitionFieldAttributes(
							statusError,
							"plan-definition-status-error",
						)}
						data-test-id="plan-definition-editor__status-dropdown"
					>
						<SelectValue />
					</SelectTrigger>
					<AppSelectContent>
						{["draft", "active", "retired"].map((status) => (
							<AppSelectItem key={status} value={status}>
								{status[0]?.toUpperCase()}
								{status.slice(1)}
							</AppSelectItem>
						))}
					</AppSelectContent>
				</Select>
				<PlanDefinitionFieldError
					id="plan-definition-status-error"
					message={statusError}
				/>
			</div>
			<div className="space-y-1.5 md:col-span-2 md:row-span-2">
				<Label htmlFor="plan-definition-description">Description</Label>
				<Textarea
					id="plan-definition-description"
					className="min-h-28"
					{...planDefinitionFieldAttributes(
						descriptionError,
						"plan-definition-description-error",
					)}
					value={planDefinition.description ?? ""}
					onChange={(event) =>
						onChange({
							description: event.target.value,
						})
					}
				/>
				<PlanDefinitionFieldError
					id="plan-definition-description-error"
					message={descriptionError}
				/>
			</div>
			<div className="space-y-1.5 md:col-span-2">
				<Label htmlFor="plan-definition-url">Canonical URL</Label>
				<Input
					id="plan-definition-url"
					invalid={Boolean(urlError)}
					{...planDefinitionFieldAttributes(
						urlError,
						"plan-definition-url-error",
					)}
					data-test-id="plan-definition-editor__url-input"
					placeholder={generatePlanDefinitionUrl(
						planDefinition.title ?? "",
						urlPrefix,
					)}
					value={automaticUrl ? "" : (planDefinition.url ?? "")}
					onChange={(event) => {
						const url = event.target.value;
						setAutomaticUrl(!url);
						onChange({
							url:
								url ||
								generatePlanDefinitionUrl(
									planDefinition.title ?? "",
									urlPrefix,
								),
						});
					}}
				/>
				<PlanDefinitionFieldError
					id="plan-definition-url-error"
					message={urlError}
				/>
			</div>
			<div className="space-y-1.5 md:col-span-2">
				<Label htmlFor="plan-definition-author">Author</Label>
				<Input
					id="plan-definition-author"
					invalid={Boolean(publisherError)}
					{...planDefinitionFieldAttributes(
						publisherError,
						"plan-definition-author-error",
					)}
					value={planDefinition.publisher ?? ""}
					onChange={(event) =>
						onChange({
							publisher: event.target.value,
						})
					}
				/>
				<PlanDefinitionFieldError
					id="plan-definition-author-error"
					message={publisherError}
				/>
			</div>
		</div>
	);
}
