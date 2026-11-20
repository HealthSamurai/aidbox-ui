import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import { findQuestionnaire } from "@aidbox-ui/components/PlanDefinition/plan-definition-model";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	cn,
	Input,
	Label,
	Select,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@health-samurai/react-components";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { Form } from "./api/forms";
import type { AidboxReferenceResource } from "./share/api";
import { humanize } from "./utils";

const DEFAULT_SELECT_VALUE = "__default__";

const LAUNCH_CONTEXT_EXTENSION_URL =
	"http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext";
// encounter has its own top-level picker; patient gets one when declared
const OVERLAPPING_LAUNCH_CONTEXT_KEYS = new Set(["encounter"]);

type QuestionnaireLaunchContextExtension = {
	extension?: QuestionnaireLaunchContextExtension[];
	url?: string;
	valueCode?: string;
	valueCoding?: {
		code?: string;
	};
};

type LaunchContextDefinition = {
	label: string;
	name: string;
	resourceType: string;
};

function findNestedExtension(
	extension: QuestionnaireLaunchContextExtension,
	url: string,
) {
	return extension.extension?.find((item) => item.url === url);
}

export function capitalizeLabel(value: string) {
	return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

export function getLaunchContextDefinitions(
	form: Form | null,
	referencedQuestionnaires: Questionnaire[] = [],
): LaunchContextDefinition[] {
	if (form?.resourceType === "PlanDefinition") {
		return [
			...new Map(
				(form.action ?? [])
					.flatMap((action) =>
						getLaunchContextDefinitions(
							findQuestionnaire(action, referencedQuestionnaires) ?? null,
						),
					)
					.map((definition) => [definition.name, definition]),
			).values(),
		];
	}
	const extensions = (
		form as Questionnaire & {
			extension?: QuestionnaireLaunchContextExtension[];
		}
	)?.extension;

	return (extensions ?? [])
		.flatMap((extension) => {
			if (extension.url !== LAUNCH_CONTEXT_EXTENSION_URL) {
				return [];
			}

			const name = findNestedExtension(extension, "name")?.valueCoding?.code;
			const resourceType = findNestedExtension(extension, "type")?.valueCode;

			if (!name || !resourceType || OVERLAPPING_LAUNCH_CONTEXT_KEYS.has(name)) {
				return [];
			}

			return [
				{
					label: capitalizeLabel(humanize(name) || name),
					name,
					resourceType,
				} satisfies LaunchContextDefinition,
			];
		})
		.sort((left, right) => left.label.localeCompare(right.label));
}

/** Picking a subject fills the declared, still-empty `patient` launch context. */
export function fillPatientFromSubject<T>(
	current: Record<string, T | null>,
	definitions: LaunchContextDefinition[],
	subject: T | null,
): Record<string, T | null> {
	return subject &&
		!current.patient &&
		definitions.some((definition) => definition.name === "patient")
		? { ...current, patient: subject }
		: current;
}

export function parseOptionalMinutes(value: string) {
	if (!value.trim()) {
		return {
			error: undefined,
			value: undefined,
		};
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < 1) {
		return {
			error: "Enter a whole number of minutes greater than 0",
			value: undefined,
		};
	}

	return {
		error: undefined,
		value: parsed,
	};
}

const MINUTE_MS = 60 * 1000;

/** Longest quiet period the renderer keeps at the start of a session before it may warn. */
const MAX_QUIET_START_MS = MINUTE_MS;

function formatDuration(durationMs: number) {
	const seconds = Math.max(1, Math.ceil(durationMs / 1000));

	if (seconds < 60) {
		return seconds === 1 ? "1 second" : `${seconds} seconds`;
	}

	const minutes = Math.max(1, Math.round(seconds / 60));

	return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * Explains when the respondent will actually see the expiration warning, for the cases where
 * "Warn before" cannot be honoured as entered: the renderer never warns right at the start of a
 * session, so it keeps a minute of work quiet (half of the session when the session is shorter
 * than two minutes) and moves the warning closer to the timeout. Returns undefined when the
 * entered value is used as is — there is nothing to explain then.
 *
 * Keep in sync with `calculate-warning-delay` in box/src-ui/sdc/forms/show/model.cljc.
 */
function describeWarningTimeout(
	sessionTimeoutMinutes: string,
	warningTimeoutMinutes: string,
) {
	const session = parseOptionalMinutes(sessionTimeoutMinutes);
	const warningBefore = parseOptionalMinutes(warningTimeoutMinutes);

	if (!session.value || !warningBefore.value) {
		return undefined;
	}

	const sessionMs = session.value * MINUTE_MS;
	const warningBeforeMs = warningBefore.value * MINUTE_MS;
	const quietStartMs = Math.min(MAX_QUIET_START_MS, Math.floor(sessionMs / 2));
	const leadTimeMs =
		sessionMs - Math.max(quietStartMs, sessionMs - warningBeforeMs);

	if (leadTimeMs >= warningBeforeMs) {
		return undefined;
	}

	return `"Session expires" is set to ${formatDuration(sessionMs)}, so the warning will appear ${formatDuration(leadTimeMs)} before the timeout.`;
}

export function resourceReference<
	T extends { id?: string; resourceType: string },
>(resource?: T | null): AidboxReferenceResource | undefined {
	if (!resource?.id) {
		return undefined;
	}

	return {
		id: resource.id,
		resourceType: resource.resourceType,
	};
}

export function questionnaireReference(
	questionnaire?: Pick<Questionnaire, "id"> | null,
): AidboxReferenceResource | undefined {
	if (!questionnaire?.id) {
		return undefined;
	}

	return {
		id: questionnaire.id,
		resourceType: "Questionnaire",
	};
}

export function Section({
	children,
	defaultOpen = true,
	description,
	onOpenChange,
	open,
	testId,
	title,
}: {
	children: React.ReactNode;
	defaultOpen?: boolean;
	description?: string;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	testId?: string;
	title: string;
}) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const resolvedOpen = open ?? internalOpen;
	const handleOpenChange = onOpenChange ?? setInternalOpen;

	return (
		<section
			className="border-t border-border-primary py-5 first:border-t-0 first:pt-0"
			data-test-id={testId}
		>
			<Collapsible open={resolvedOpen} onOpenChange={handleOpenChange}>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						data-test-id={testId ? `${testId}__toggle` : undefined}
						className="flex w-full cursor-pointer items-start justify-between gap-3 text-left outline-none"
					>
						<span className="grid gap-1">
							<span className="text-base font-semibold text-text-primary">
								{title}
							</span>
							{description ? (
								<span className="text-sm text-text-secondary">
									{description}
								</span>
							) : null}
						</span>
						<ChevronDown
							size={20}
							className={cn(
								"mt-1 shrink-0 text-text-secondary transition-transform",
								resolvedOpen && "rotate-180",
							)}
						/>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent className="grid gap-4 pt-5">
					{children}
				</CollapsibleContent>
			</Collapsible>
		</section>
	);
}

export function Row({
	children,
	description,
	error,
	htmlFor,
	label,
	required,
	responsiveTo = "viewport",
	testId,
}: {
	children: React.ReactNode;
	description?: string;
	error?: string;
	htmlFor?: string;
	label: string;
	required?: boolean;
	responsiveTo?: "container" | "viewport";
	testId?: string;
}) {
	return (
		<div
			className={cn(
				"grid items-start gap-x-4 gap-y-1",
				responsiveTo === "container"
					? "@md/share-form:grid-cols-[10rem_minmax(0,1fr)]"
					: "sm:grid-cols-[10rem_minmax(0,1fr)]",
			)}
			data-test-id={testId}
		>
			<Label htmlFor={htmlFor}>
				{label}
				{required ? <span className="text-text-error-primary"> *</span> : null}
			</Label>
			<div className="grid gap-1">
				{children}
				{error ? (
					<p
						className="text-xs text-text-error-primary"
						data-test-id={testId ? `${testId}__error` : undefined}
					>
						{error}
					</p>
				) : description ? (
					<p
						className="text-xs text-text-tertiary"
						data-test-id={testId ? `${testId}__description` : undefined}
					>
						{description}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function GroupLabel({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"text-xs font-medium uppercase tracking-wide text-text-tertiary",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function ToggleRow({
	checked,
	label,
	onChange,
	testId,
}: {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
	testId?: string;
}) {
	const switchId = useId();

	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={switchId}>{label}</Label>
			<Switch
				id={switchId}
				data-test-id={testId}
				checked={checked}
				onCheckedChange={onChange}
			/>
		</div>
	);
}

/** A whole number with a unit suffix; the caller validates the text. */
export function UnitInput({
	id,
	onChange,
	testId,
	unit,
	value,
	ariaLabel,
	placeholder,
}: {
	id: string;
	onChange: (value: string) => void;
	testId?: string;
	unit: string;
	value: string;
	ariaLabel?: string;
	placeholder?: string;
}) {
	return (
		<div className="w-full sm:w-[7.5rem]">
			<Input
				id={id}
				inputMode="numeric"
				aria-label={ariaLabel}
				data-test-id={testId}
				className="bg-bg-primary"
				suffix={unit}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</div>
	);
}

type SelectOption = {
	label: string;
	value: string;
};

export function FormSettingsFields({
	configurationOptions,
	isConfigurationLoading,
	isThemeLoading,
	rowResponsiveTo = "viewport",
	selectedConfigId,
	selectedThemeId,
	setSelectedConfigId,
	setSelectedThemeId,
	testIdPrefix,
	themeOptions,
}: {
	configurationOptions: SelectOption[];
	isConfigurationLoading: boolean;
	isThemeLoading: boolean;
	rowResponsiveTo?: "container" | "viewport";
	selectedConfigId: string;
	selectedThemeId: string;
	setSelectedConfigId: (value: string) => void;
	setSelectedThemeId: (value: string) => void;
	testIdPrefix: string;
	themeOptions: SelectOption[];
}) {
	return (
		<>
			<Row
				label="Theme"
				responsiveTo={rowResponsiveTo}
				testId={`${testIdPrefix}__theme-field`}
			>
				<Select
					value={selectedThemeId || DEFAULT_SELECT_VALUE}
					onValueChange={(value) =>
						setSelectedThemeId(value === DEFAULT_SELECT_VALUE ? "" : value)
					}
					disabled={isThemeLoading}
				>
					<SelectTrigger
						className="w-full bg-bg-primary"
						data-test-id={`${testIdPrefix}__theme-dropdown`}
					>
						<SelectValue placeholder="Default - renderer theme" />
					</SelectTrigger>
					<AppSelectContent data-test-id={`${testIdPrefix}__theme-options`}>
						<AppSelectItem
							data-test-id={`${testIdPrefix}__theme-option`}
							value={DEFAULT_SELECT_VALUE}
						>
							Default - renderer theme
						</AppSelectItem>
						{themeOptions.map((option) => (
							<AppSelectItem
								key={option.value}
								data-test-id={`${testIdPrefix}__theme-option`}
								value={option.value}
							>
								{option.label}
							</AppSelectItem>
						))}
					</AppSelectContent>
				</Select>
			</Row>

			<Row
				label="Configuration"
				responsiveTo={rowResponsiveTo}
				testId={`${testIdPrefix}__configuration-field`}
			>
				<Select
					value={selectedConfigId || DEFAULT_SELECT_VALUE}
					onValueChange={(value) =>
						setSelectedConfigId(value === DEFAULT_SELECT_VALUE ? "" : value)
					}
					disabled={isConfigurationLoading}
				>
					<SelectTrigger
						className="w-full bg-bg-primary"
						data-test-id={`${testIdPrefix}__configuration-dropdown`}
					>
						<SelectValue placeholder="Default - no SDC config attached" />
					</SelectTrigger>
					<AppSelectContent
						data-test-id={`${testIdPrefix}__configuration-options`}
					>
						<AppSelectItem
							data-test-id={`${testIdPrefix}__configuration-option`}
							value={DEFAULT_SELECT_VALUE}
						>
							Default - no SDC config attached
						</AppSelectItem>
						{configurationOptions.map((option) => (
							<AppSelectItem
								key={option.value}
								data-test-id={`${testIdPrefix}__configuration-option`}
								value={option.value}
							>
								{option.label}
							</AppSelectItem>
						))}
					</AppSelectContent>
				</Select>
			</Row>
		</>
	);
}

export function FormBehaviorFields({
	isPlanDefinition = false,
	allowAmend,
	allowRepopulate,
	idPrefix,
	readOnly,
	redirectOnSave,
	redirectOnSubmit,
	redirectOnTimeout,
	rowResponsiveTo = "viewport",
	sessionTimeoutError,
	sessionTimeoutMinutes,
	setAllowAmend,
	setAllowRepopulate,
	setReadOnly,
	setRedirectOnSave,
	setRedirectOnSubmit,
	setRedirectOnTimeout,
	setSessionTimeoutMinutes,
	setWarningTimeoutMinutes,
	testIdPrefix,
	warningTimeoutError,
	warningTimeoutMinutes,
}: {
	isPlanDefinition?: boolean;
	allowAmend: boolean;
	allowRepopulate: boolean;
	idPrefix: string;
	readOnly: boolean;
	redirectOnSave: string;
	redirectOnSubmit: string;
	redirectOnTimeout: string;
	rowResponsiveTo?: "container" | "viewport";
	sessionTimeoutError?: string;
	sessionTimeoutMinutes: string;
	setAllowAmend: (value: boolean) => void;
	setAllowRepopulate: (value: boolean) => void;
	setReadOnly: (value: boolean) => void;
	setRedirectOnSave: (value: string) => void;
	setRedirectOnSubmit: (value: string) => void;
	setRedirectOnTimeout: (value: string) => void;
	setSessionTimeoutMinutes: (value: string) => void;
	setWarningTimeoutMinutes: (value: string) => void;
	testIdPrefix: string;
	warningTimeoutError?: string;
	warningTimeoutMinutes: string;
}) {
	return (
		<>
			<GroupLabel className="pt-3">Permissions</GroupLabel>
			<div className="grid gap-[1.125rem]">
				{!isPlanDefinition && (
					<ToggleRow
						checked={readOnly}
						label="Open read-only"
						onChange={setReadOnly}
						testId={`${testIdPrefix}__read-only-switch`}
					/>
				)}
				<ToggleRow
					checked={allowAmend}
					label="Allow amending a submitted response"
					onChange={setAllowAmend}
					testId={`${testIdPrefix}__allow-amend-switch`}
				/>
				{!isPlanDefinition && (
					<ToggleRow
						checked={allowRepopulate}
						label="Allow repopulating with existing data"
						onChange={setAllowRepopulate}
						testId={`${testIdPrefix}__allow-repopulate-switch`}
					/>
				)}
			</div>

			<GroupLabel className="pt-3">Timeouts</GroupLabel>
			<Row
				htmlFor={`${idPrefix}-session-timeout`}
				label="Session expires"
				error={sessionTimeoutError}
				responsiveTo={rowResponsiveTo}
				testId={`${testIdPrefix}__session-timeout-field`}
			>
				<UnitInput
					unit="min"
					placeholder="Never"
					id={`${idPrefix}-session-timeout`}
					testId={`${testIdPrefix}__session-timeout-input`}
					value={sessionTimeoutMinutes}
					onChange={setSessionTimeoutMinutes}
				/>
			</Row>
			<Row
				htmlFor={`${idPrefix}-warning-timeout`}
				label="Warn before"
				description={describeWarningTimeout(
					sessionTimeoutMinutes,
					warningTimeoutMinutes,
				)}
				error={warningTimeoutError}
				responsiveTo={rowResponsiveTo}
				testId={`${testIdPrefix}__warning-timeout-field`}
			>
				<UnitInput
					unit="min"
					placeholder="Never"
					id={`${idPrefix}-warning-timeout`}
					testId={`${testIdPrefix}__warning-timeout-input`}
					value={warningTimeoutMinutes}
					onChange={setWarningTimeoutMinutes}
				/>
			</Row>

			<GroupLabel className="pt-3">Redirects</GroupLabel>
			<Row
				htmlFor={`${idPrefix}-redirect-on-submit`}
				label="On submit"
				responsiveTo={rowResponsiveTo}
			>
				<Input
					id={`${idPrefix}-redirect-on-submit`}
					data-test-id={`${testIdPrefix}__redirect-on-submit-input`}
					inputMode="url"
					className="bg-bg-primary"
					placeholder="https://example.com"
					value={redirectOnSubmit}
					onChange={(event) => setRedirectOnSubmit(event.target.value)}
				/>
			</Row>
			<Row
				htmlFor={`${idPrefix}-redirect-on-save`}
				label="On save"
				responsiveTo={rowResponsiveTo}
			>
				<Input
					id={`${idPrefix}-redirect-on-save`}
					data-test-id={`${testIdPrefix}__redirect-on-save-input`}
					inputMode="url"
					className="bg-bg-primary"
					placeholder="https://example.com"
					value={redirectOnSave}
					onChange={(event) => setRedirectOnSave(event.target.value)}
				/>
			</Row>
			<Row
				htmlFor={`${idPrefix}-redirect-on-timeout`}
				label="On timeout"
				responsiveTo={rowResponsiveTo}
			>
				<Input
					id={`${idPrefix}-redirect-on-timeout`}
					data-test-id={`${testIdPrefix}__redirect-on-timeout-input`}
					inputMode="url"
					className="bg-bg-primary"
					placeholder="https://example.com"
					value={redirectOnTimeout}
					onChange={(event) => setRedirectOnTimeout(event.target.value)}
				/>
			</Row>
		</>
	);
}
