import {
	Alert,
	AlertDescription,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Database, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import { getAidboxBaseURL } from "../../utils";

interface ImportInput {
	resourceType: string;
	url: string;
}

const r4Dataset: ImportInput[] = [
	{
		resourceType: "AllergyIntolerance",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/AllergyIntolerance.ndjson.gz",
	},
	{
		resourceType: "CarePlan",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/CarePlan.ndjson.gz",
	},
	{
		resourceType: "CareTeam",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/CareTeam.ndjson.gz",
	},
	{
		resourceType: "Claim",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Claim.ndjson.gz",
	},
	{
		resourceType: "Condition",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Condition.ndjson.gz",
	},
	{
		resourceType: "Device",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Device.ndjson.gz",
	},
	{
		resourceType: "DiagnosticReport",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/DiagnosticReport.ndjson.gz",
	},
	{
		resourceType: "DocumentReference",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/DocumentReference.ndjson.gz",
	},
	{
		resourceType: "Encounter",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Encounter.ndjson.gz",
	},
	{
		resourceType: "ExplanationOfBenefit",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/ExplanationOfBenefit.ndjson.gz",
	},
	{
		resourceType: "ImagingStudy",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/ImagingStudy.ndjson.gz",
	},
	{
		resourceType: "Immunization",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Immunization.ndjson.gz",
	},
	{
		resourceType: "Location",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Location.ndjson.gz",
	},
	{
		resourceType: "Medication",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Medication.ndjson.gz",
	},
	{
		resourceType: "MedicationAdministration",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/MedicationAdministration.ndjson.gz",
	},
	{
		resourceType: "MedicationRequest",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/MedicationRequest.ndjson.gz",
	},
	{
		resourceType: "Observation",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Observation.ndjson.gz",
	},
	{
		resourceType: "Organization",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Organization.ndjson.gz",
	},
	{
		resourceType: "Patient",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Patient.ndjson.gz",
	},
	{
		resourceType: "Practitioner",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Practitioner.ndjson.gz",
	},
	{
		resourceType: "PractitionerRole",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/PractitionerRole.ndjson.gz",
	},
	{
		resourceType: "Procedure",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Procedure.ndjson.gz",
	},
	{
		resourceType: "Provenance",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/Provenance.ndjson.gz",
	},
	{
		resourceType: "SupplyDelivery",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/100/fhir/SupplyDelivery.ndjson.gz",
	},
];

const r6Dataset: ImportInput[] = [
	{
		resourceType: "Appointment",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Appointment.ndjson.gz",
	},
	{
		resourceType: "Claim",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Claim.ndjson.gz",
	},
	{
		resourceType: "Condition",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Condition.ndjson.gz",
	},
	{
		resourceType: "DiagnosticReport",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/DiagnosticReport.ndjson.gz",
	},
	{
		resourceType: "Encounter",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Encounter.ndjson.gz",
	},
	{
		resourceType: "Immunization",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Immunization.ndjson.gz",
	},
	{
		resourceType: "Location",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Location.ndjson.gz",
	},
	{
		resourceType: "Medication",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Medication.ndjson.gz",
	},
	{
		resourceType: "Observation",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Observation.ndjson.gz",
	},
	{
		resourceType: "Organization",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Organization.ndjson.gz",
	},
	{
		resourceType: "Patient",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Patient.ndjson.gz",
	},
	{
		resourceType: "Practitioner",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Practitioner.ndjson.gz",
	},
	{
		resourceType: "PractitionerRole",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/PractitionerRole.ndjson.gz",
	},
	{
		resourceType: "Procedure",
		url: "https://storage.googleapis.com/aidbox-public/synthea/v2/R6/100/fhir/Procedure.ndjson.gz",
	},
];

// --- Hooks ---

type ImportPhase = "initial" | "ready" | "loading" | "success" | "error";

interface ImportState {
	phase: ImportPhase;
	importedResources: string[];
	rtInProgress?: string;
	resourceTypesCount?: number;
	httpStatus?: number;
}

function useAidboxConfig() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["aidbox-config-home"],
		queryFn: async () => {
			const result = await client.request<Record<string, unknown>>({
				method: "GET",
				url: "/$config",
			});
			if (result.isErr()) throw new Error("Failed to fetch config");
			const data = result.value.resource as Record<string, unknown>;
			const features = data?.features as Record<string, unknown> | undefined;
			return {
				fhirVersion: (data?.["fhir-version"] as string) ?? "",
				lbacEnabled: (features?.["lbac-enabled"] as boolean) ?? false,
			};
		},
		staleTime: Number.POSITIVE_INFINITY,
	});
}

async function aidboxFetch(path: string, init?: RequestInit) {
	const base = getAidboxBaseURL();
	const res = await fetch(`${base}${path}`, {
		credentials: "include",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		...init,
	});
	return { data: await res.json(), status: res.status, ok: res.ok };
}

function useDatasetImport(lbacEnabled: boolean) {
	return useQuery<ImportState>({
		queryKey: ["dataset-import-status"],
		queryFn: async (): Promise<ImportState> => {
			// Step 1: check workflow exists
			const workflow = await aidboxFetch(
				"/AidboxWorkflow/onboarding-synthetic-dataset",
			);
			if (!workflow.ok) {
				if (workflow.data?.id === "not-found") {
					return { phase: "ready", importedResources: [] };
				}
				return {
					phase: "error",
					importedResources: [],
					httpStatus: workflow.status,
				};
			}

			// Step 2: check import status
			const res = await aidboxFetch("/v2/$import/onboarding-synthetic-dataset");
			if (!res.ok) {
				if (res.data?.id === "not-found") {
					return { phase: "ready", importedResources: [] };
				}
				return {
					phase: "error",
					importedResources: [],
					httpStatus: res.status,
				};
			}

			const inputs = (res.data?.inputs ?? []) as Array<{
				resourceType: string;
				status: string;
				outcome?: string;
			}>;
			const importedResources = inputs
				.filter((i) => i.status === "done" && i.outcome === "succeeded")
				.map((i) => i.resourceType);
			const rtInProgress = inputs.find(
				(i) => i.status === "in-progress",
			)?.resourceType;

			if (res.data?.status === "done" && res.data?.outcome === "succeeded") {
				return { phase: "success", importedResources };
			}
			if (res.data?.status === "in-progress") {
				return {
					phase: "loading",
					importedResources,
					rtInProgress,
					resourceTypesCount: inputs.length,
				};
			}
			return { phase: "error", importedResources };
		},
		refetchInterval: (query) =>
			query.state.data?.phase === "loading" ? 1000 : false,
		enabled: !lbacEnabled,
	});
}

// --- Component ---

export function DataImport() {
	const { data: config } = useAidboxConfig();
	const fhirVersion = config?.fhirVersion ?? "";
	const lbacEnabled = config?.lbacEnabled ?? false;

	const queryClient = useQueryClient();
	const { data: importState } = useDatasetImport(lbacEnabled);
	const phase = importState?.phase ?? "initial";
	const importAccessDenied = importState?.httpStatus === 403;

	const [dialogOpen, setDialogOpen] = useState(false);

	const importMutation = useMutation({
		mutationFn: async () => {
			const dataset = fhirVersion.startsWith("6.0.0") ? r6Dataset : r4Dataset;
			const res = await aidboxFetch("/v2/fhir/$import", {
				method: "POST",
				body: JSON.stringify({
					id: "onboarding-synthetic-dataset",
					contentEncoding: "gzip",
					inputs: dataset,
				}),
			});
			if (!res.ok) throw { status: res.status, data: res.data };
			return res.data;
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: ["dataset-import-status"],
			});
		},
	});

	const totalResourceTypes =
		importState?.resourceTypesCount ??
		(fhirVersion.startsWith("6.0.0") ? 14 : 24);

	return (
		<>
			<div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2">
				{/* Left: description and doc links */}
				<div className="flex max-w-[548px] flex-col items-start gap-4">
					<h2 className="text-2xl font-semibold text-text-primary">
						Import Data
					</h2>
					<p className="text-base leading-relaxed text-text-secondary">
						Use Aidbox FHIR CRUD and bulk APIs to import your data or quickstart
						by using a synthetic dataset.
					</p>
					<div className="flex flex-wrap items-start gap-2">
						<a
							href="https://docs.aidbox.app/api-1/api/crud-1"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button variant="secondary" size="small" className="p-2">
								<BookOpen className="size-3.5" />
								<span>CRUD API</span>
							</Button>
						</a>
						<a
							href="https://docs.aidbox.app/api-1/fhir-api/bundle"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button variant="secondary" size="small" className="p-2">
								<BookOpen className="size-3.5" />
								<span>Bundle</span>
							</Button>
						</a>
						<a
							href="https://docs.aidbox.app/api-1/bulk-api-1"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button variant="secondary" size="small" className="p-2">
								<BookOpen className="size-3.5" />
								<span>Bulk import</span>
							</Button>
						</a>
					</div>
				</div>

				{/* Right: synthetic dataset import */}
				<div className="rounded-lg border-2 border-dashed border-border-primary px-10 py-8">
					<div className="flex flex-col items-center justify-center gap-4 self-stretch">
						<div className="flex flex-col items-center gap-2.5 self-stretch">
							<div className="flex flex-col items-center gap-4 self-stretch">
								<Database className="size-6 text-text-tertiary" />
								<span className="text-sm font-semibold text-text-primary">
									Import Synthetic Dataset
								</span>
							</div>

							{phase === "loading" && (
								<p className="min-h-[21px] pt-0.5 text-center text-xs text-text-tertiary">
									Loading {importState?.rtInProgress} resources... (
									{importState?.importedResources.length}/{totalResourceTypes})
								</p>
							)}

							{phase === "error" && (
								<Alert variant="critical">
									<AlertDescription>
										{importAccessDenied ? (
											"You don't have permission to perform this action"
										) : (
											<>
												Import failed. Try again or{" "}
												<a
													href="https://docs.aidbox.app/overview/contact-us"
													target="_blank"
													rel="noopener noreferrer"
													className="underline"
												>
													contact us
												</a>{" "}
												to report a bug.
											</>
										)}
									</AlertDescription>
								</Alert>
							)}

							{lbacEnabled && (
								<Alert variant="info">
									<AlertDescription>
										<div className="flex flex-col items-center">
											<span>Test dataset is not compatible with LBAC.</span>
											<div>
												<a
													href="/ui/console#/settings?search=Enable%20LBAC"
													target="_blank"
													rel="noopener noreferrer"
													className="underline"
												>
													Disable LBAC
												</a>{" "}
												to import the dataset.
											</div>
										</div>
									</AlertDescription>
								</Alert>
							)}

							{phase !== "loading" && phase !== "error" && !lbacEnabled && (
								<p className="min-h-[21px] pt-0.5 text-center text-xs text-text-tertiary">
									A dataset of 100 synthetic patient records that loads in a few
									seconds.
								</p>
							)}
						</div>

						{!lbacEnabled && (
							<div className={phase === "initial" ? "opacity-0" : ""}>
								{phase === "success" ? (
									<Button variant="ghost" disabled className="text-green-600 disabled:text-green-600">
										<Check className="size-4" />
										<span>Successfully loaded</span>
									</Button>
								) : (
									<Button
										variant="secondary"
										disabled={importAccessDenied || phase === "loading"}
										onClick={() => setDialogOpen(true)}
									>
										{phase === "loading" ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Upload
												className={`size-4 ${!importAccessDenied ? "text-red-500" : ""}`}
											/>
										)}
										<span>Import</span>
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Confirmation dialog */}
			<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<AlertDialogContent className="max-w-[600px]">
					<AlertDialogHeader>
						<AlertDialogTitle>Import confirmation</AlertDialogTitle>
					</AlertDialogHeader>
					<Alert variant="warning">
						<AlertDescription>
							<p>This action will import 100 patients' data into Aidbox.</p>
							<p>
								Before proceeding, make sure this is not a production
								environment.
							</p>
						</AlertDescription>
					</Alert>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								importMutation.mutate();
								setDialogOpen(false);
							}}
						>
							Import
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
