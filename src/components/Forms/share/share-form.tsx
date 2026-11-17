import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Encounter,
	Patient,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import {
	Button,
	cn,
	DialogFooter,
	toast,
} from "@health-samurai/react-components";
import { useQueries } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
	getConfigurationLabel,
	getQuestionnaireThemeLabel,
	useConfigurationReferences,
	useQuestionnaireThemes,
} from "../api/configurations";
import type { Form } from "../api/forms";
import { useQuestionnaireMetadata } from "../api/plan-definitions";
import {
	capitalizeLabel,
	FormBehaviorFields,
	FormSettingsFields,
	fillPatientFromSubject,
	getLaunchContextDefinitions,
	parseOptionalMinutes,
	questionnaireReference,
	Row,
	resourceReference,
	Section,
} from "../form-dialog-fields";
import {
	type AidboxReferenceResource,
	type AidboxSearchResource,
	formatAidboxReferenceLabel,
	formatEncounterLabel,
	formatPatientLabel,
	searchAidboxReferenceResources,
	useEncounters,
	useGenerateFormLink,
	usePatients,
} from "./api";
import { ResourceSearchSelect } from "./resource-search-select";

type ShareFormProps = {
	active?: boolean;
	layout?: "dialog" | "page";
	onCancel?: () => void;
	onGenerateLink: (link: string) => void;
	form: Form | null;
	formControl?: ReactNode;
	testIdPrefix: string;
};

export function ShareForm({
	active = true,
	layout = "dialog",
	onCancel,
	onGenerateLink,
	form,
	formControl,
	testIdPrefix,
}: ShareFormProps) {
	const [patientQuery, setPatientQuery] = useState("");
	const [encounterQuery, setEncounterQuery] = useState("");
	const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
	const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(
		null,
	);
	const [selectedThemeId, setSelectedThemeId] = useState("");
	const [selectedConfigId, setSelectedConfigId] = useState("");
	const [readOnly, setReadOnly] = useState(false);
	const [allowAmend, setAllowAmend] = useState(false);
	const [allowRepopulate, setAllowRepopulate] = useState(false);
	const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("");
	const [warningTimeoutMinutes, setWarningTimeoutMinutes] = useState("");
	const [redirectOnSubmit, setRedirectOnSubmit] = useState("");
	const [redirectOnSave, setRedirectOnSave] = useState("");
	const [redirectOnTimeout, setRedirectOnTimeout] = useState("");
	const [launchContextQueryByName, setLaunchContextQueryByName] = useState<
		Record<string, string>
	>({});
	const [selectedLaunchContextByName, setSelectedLaunchContextByName] =
		useState<Record<string, AidboxSearchResource | null>>({});

	const isPlanDefinition = form?.resourceType === "PlanDefinition";
	const enabled = active && Boolean(form);
	const referencedQuestionnaires = useQuestionnaireMetadata(
		enabled && isPlanDefinition,
	);
	const launchContextDefinitions = useMemo(
		() =>
			getLaunchContextDefinitions(
				form,
				referencedQuestionnaires.data?.resources,
			),
		[form, referencedQuestionnaires.data],
	);
	const patientsQuery = usePatients(patientQuery, enabled);
	const encountersQuery = useEncounters(encounterQuery, enabled);
	const themesQuery = useQuestionnaireThemes(enabled);
	const configurationReferencesQuery = useConfigurationReferences(enabled);
	const aidboxClient = useAidboxClient();
	const launchContextQueries = useQueries({
		queries: launchContextDefinitions.map((definition) => ({
			enabled,
			placeholderData: (previousData: AidboxSearchResource[] | undefined) =>
				previousData,
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				searchAidboxReferenceResources(
					aidboxClient,
					definition.resourceType,
					launchContextQueryByName[definition.name] ?? "",
					signal,
				),
			queryKey: [
				"share-form",
				"launch-context",
				definition.resourceType,
				launchContextQueryByName[definition.name] ?? "",
			],
			refetchOnWindowFocus: false,
			staleTime: 60 * 1000,
		})),
	});
	const generateFormLink = useGenerateFormLink();
	const sessionTimeout = useMemo(
		() => parseOptionalMinutes(sessionTimeoutMinutes),
		[sessionTimeoutMinutes],
	);
	const warningTimeout = useMemo(
		() => parseOptionalMinutes(warningTimeoutMinutes),
		[warningTimeoutMinutes],
	);
	const themeOptions = useMemo(
		() =>
			(themesQuery.data ?? [])
				.filter((theme) => Boolean(theme.id))
				.map((theme) => ({
					label: getQuestionnaireThemeLabel(theme),
					value: theme.id ?? "",
				})),
		[themesQuery.data],
	);
	const configurationOptions = useMemo(
		() =>
			(configurationReferencesQuery.data ?? [])
				.filter((configuration) => Boolean(configuration.id))
				.map((configuration) => ({
					label: getConfigurationLabel(configuration),
					value: configuration.id ?? "",
				})),
		[configurationReferencesQuery.data],
	);
	const selectedLaunchContextReferences = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(selectedLaunchContextByName).flatMap(
					([name, resource]) =>
						resource?.id
							? [
									[
										name,
										{
											id: resource.id,
											resourceType: resource.resourceType,
										} satisfies AidboxReferenceResource,
									],
								]
							: [],
				),
			),
		[selectedLaunchContextByName],
	);
	const isBusy = generateFormLink.isPending;
	const canGenerate =
		!isBusy &&
		Boolean(form?.id) &&
		!sessionTimeout.error &&
		!warningTimeout.error;
	const statusLabel = capitalizeLabel(form?.status ?? "");

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formRef =
			form?.resourceType === "PlanDefinition" && form.id
				? { resourceType: "PlanDefinition", id: form.id }
				: questionnaireReference(
						form?.resourceType === "Questionnaire" ? form : null,
					);

		if (!formRef || !canGenerate) {
			return;
		}

		void generateFormLink
			.mutateAsync({
				allowAmend,
				allowRepopulate,
				configId: selectedConfigId || undefined,
				encounter: resourceReference(selectedEncounter),
				launchContext: selectedLaunchContextReferences,
				form: formRef,
				readOnly,
				redirectOnSave: redirectOnSave || undefined,
				redirectOnSubmit: redirectOnSubmit || undefined,
				redirectOnTimeout: redirectOnTimeout || undefined,
				sessionTimeout: sessionTimeout.value,
				subject: resourceReference(selectedPatient),
				themeId: selectedThemeId || undefined,
				warningTimeout: warningTimeout.value,
			})
			.then((link) => {
				toast.success("Form link generated");
				onGenerateLink(link);
			})
			.catch((error: unknown) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to generate form link",
				);
			});
	};

	return (
		<form
			className={cn(
				"@container/share-form flex min-h-0 flex-col",
				layout === "dialog" && "flex-1",
			)}
			data-test-id={`${testIdPrefix}__form`}
			onSubmit={handleSubmit}
		>
			<div
				className={cn(
					layout === "dialog"
						? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 [scrollbar-gutter:stable]"
						: "w-full max-w-[52rem] px-4 pb-6 pt-2 sm:px-5",
				)}
			>
				{formControl ?? (
					<div className="flex items-center gap-3 rounded-lg bg-bg-secondary px-4 py-3">
						<span
							className="shrink-0 text-sm font-semibold text-text-primary"
							data-test-id={`${testIdPrefix}__form-status-text`}
						>
							{statusLabel
								? `${statusLabel} ${isPlanDefinition ? "package" : "form"}`
								: "Form"}
						</span>
						<span
							className="truncate text-sm text-text-secondary"
							data-test-id={`${testIdPrefix}__form-reference-text`}
						>
							{form?.id ? `${form.resourceType}/${form.id}` : "Questionnaire"}
						</span>
					</div>
				)}

				<div className="mt-5">
					{isPlanDefinition && referencedQuestionnaires.isError && (
						<p role="alert" className="mb-4 text-sm text-text-error-primary">
							Could not load the package’s prefill fields.{" "}
							<Button
								variant="ghost"
								size="small"
								type="button"
								onClick={() => void referencedQuestionnaires.refetch()}
							>
								Retry
							</Button>
						</p>
					)}
					<Section
						title="Prefill data"
						description="Patient, encounter, and launch context"
						defaultOpen={false}
						testId={`${testIdPrefix}__prefill-section`}
					>
						<Row
							label="Patient"
							responsiveTo="container"
							testId={`${testIdPrefix}__patient-field`}
						>
							<ResourceSearchSelect
								items={patientsQuery.data ?? []}
								isLoading={patientsQuery.isLoading}
								getKey={(patient) => patient.id ?? ""}
								getLabel={(patient) => formatPatientLabel(patient)}
								onQueryChange={setPatientQuery}
								onSelect={(patient) => {
									setSelectedPatient(patient);
									setSelectedLaunchContextByName((current) =>
										fillPatientFromSubject(
											current,
											launchContextDefinitions,
											patient as AidboxSearchResource | null,
										),
									);
								}}
								placeholder="Select patient"
								searchPlaceholder="Search patients..."
								selectedItem={selectedPatient}
								testId={`${testIdPrefix}__patient-select`}
							/>
						</Row>

						<Row
							label="Encounter"
							responsiveTo="container"
							testId={`${testIdPrefix}__encounter-field`}
						>
							<ResourceSearchSelect
								items={encountersQuery.data ?? []}
								isLoading={encountersQuery.isLoading}
								getKey={(encounter) => encounter.id ?? ""}
								getLabel={(encounter) => formatEncounterLabel(encounter)}
								onQueryChange={setEncounterQuery}
								onSelect={setSelectedEncounter}
								placeholder="Select encounter"
								searchPlaceholder="Search encounters..."
								selectedItem={selectedEncounter}
								testId={`${testIdPrefix}__encounter-select`}
							/>
						</Row>

						{launchContextDefinitions.map((definition, index) => (
							<Row
								key={definition.name}
								label={definition.label}
								responsiveTo="container"
								testId={`${testIdPrefix}__launch-context-${definition.name}-field`}
							>
								<ResourceSearchSelect
									items={launchContextQueries[index]?.data ?? []}
									isLoading={launchContextQueries[index]?.isLoading ?? false}
									getKey={(resource) => resource.id ?? ""}
									getLabel={formatAidboxReferenceLabel}
									onQueryChange={(value) =>
										setLaunchContextQueryByName((current) => ({
											...current,
											[definition.name]: value,
										}))
									}
									onSelect={(resource) =>
										setSelectedLaunchContextByName((current) => ({
											...current,
											[definition.name]: resource,
										}))
									}
									placeholder={`Select ${definition.label.toLowerCase()}`}
									searchPlaceholder={`Search ${definition.label.toLowerCase()}...`}
									selectedItem={
										selectedLaunchContextByName[definition.name] ?? null
									}
									testId={`${testIdPrefix}__launch-context-${definition.name}-select`}
								/>
							</Row>
						))}
					</Section>

					<Section
						title="Form settings"
						testId={`${testIdPrefix}__settings-section`}
					>
						<FormSettingsFields
							configurationOptions={configurationOptions}
							isConfigurationLoading={configurationReferencesQuery.isLoading}
							isThemeLoading={themesQuery.isLoading}
							rowResponsiveTo="container"
							selectedConfigId={selectedConfigId}
							selectedThemeId={selectedThemeId}
							setSelectedConfigId={setSelectedConfigId}
							setSelectedThemeId={setSelectedThemeId}
							testIdPrefix={testIdPrefix}
							themeOptions={themeOptions}
						/>
					</Section>

					<Section
						title="Form behavior"
						testId={`${testIdPrefix}__behavior-section`}
					>
						<FormBehaviorFields
							isPlanDefinition={isPlanDefinition}
							allowAmend={allowAmend}
							allowRepopulate={allowRepopulate}
							idPrefix={testIdPrefix}
							readOnly={readOnly}
							redirectOnSave={redirectOnSave}
							redirectOnSubmit={redirectOnSubmit}
							redirectOnTimeout={redirectOnTimeout}
							rowResponsiveTo="container"
							sessionTimeoutError={sessionTimeout.error}
							sessionTimeoutMinutes={sessionTimeoutMinutes}
							setAllowAmend={setAllowAmend}
							setAllowRepopulate={setAllowRepopulate}
							setReadOnly={setReadOnly}
							setRedirectOnSave={setRedirectOnSave}
							setRedirectOnSubmit={setRedirectOnSubmit}
							setRedirectOnTimeout={setRedirectOnTimeout}
							setSessionTimeoutMinutes={setSessionTimeoutMinutes}
							setWarningTimeoutMinutes={setWarningTimeoutMinutes}
							testIdPrefix={testIdPrefix}
							warningTimeoutError={warningTimeout.error}
							warningTimeoutMinutes={warningTimeoutMinutes}
						/>
					</Section>
				</div>
			</div>
			<DialogFooter
				className={cn(
					layout === "dialog"
						? "border-t border-border-primary bg-bg-primary px-6 py-4"
						: "w-full max-w-[52rem] justify-end bg-bg-primary px-4 pb-8 pt-1 sm:px-5",
				)}
			>
				{onCancel ? (
					<Button
						type="button"
						variant="secondary"
						data-test-id={`${testIdPrefix}__cancel-button`}
						onClick={onCancel}
						disabled={isBusy}
					>
						Cancel
					</Button>
				) : null}
				<Button
					type="submit"
					data-test-id={`${testIdPrefix}__generate-link-button`}
					disabled={!canGenerate}
				>
					<Link2 size={16} />
					Generate link
				</Button>
			</DialogFooter>
		</form>
	);
}
