import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	Encounter,
	Patient,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { boxJson, boxRequest } from "@aidbox-ui/utils/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bundleResources, type Form } from "../api/forms";
import { buildShareModePatch, type ShareMode } from "./sharing";

export type AidboxReferenceResource = {
	id: string;
	resourceType: string;
};

/** A resource of this box passed to a `$populatelink` / `$send` request. */
export type ContextReference = AidboxReferenceResource;

export type AidboxLaunchContext = Record<string, ContextReference>;

export type AidboxSearchResource = Resource & {
	description?: string;
	id?: string;
	meta?: {
		lastUpdated?: string;
	};
	name?:
		| string
		| Array<{
				family?: string;
				given?: string[];
				text?: string;
		  }>;
	resourceType: string;
	subject?: {
		display?: string;
		reference?: string;
	};
	title?: string;
};

type SharedLinkParams = {
	configId?: string;
	encounter?: ContextReference;
	launchContext?: AidboxLaunchContext;
	subject?: ContextReference;
	themeId?: string;
	allowAmend?: boolean;
	allowRepopulate?: boolean;
	readOnly?: boolean;
	redirectOnSubmit?: string;
	redirectOnSave?: string;
	redirectOnTimeout?: string;
	sessionTimeout?: number;
	warningTimeout?: number;
};

type SendFormParams = SharedLinkParams & {
	clinicianEmail?: string;
	deadlineDays: number;
	email: string;
	emailMessage?: string;
	emailProvider: string;
	emailSubject?: string;
	followUpDays: number;
	followUpEnabled: boolean;
	followUpMessage?: string;
	followUpTime: string;
	form: AidboxReferenceResource;
	sendAt?: string;
};

type GenerateFormLinkParams = SharedLinkParams & {
	form: AidboxReferenceResource;
};

async function searchAidboxResources<T extends Resource>(
	client: AidboxClientR5,
	type: string,
	query: URLSearchParams,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `boxRequest`).
	_signal?: AbortSignal,
) {
	const bundle = await boxJson<Bundle>(
		client,
		{ method: "GET", url: `/fhir/${type}`, params: [...query] },
		`Failed to fetch ${type}`,
	);

	return bundleResources<T>(bundle, type);
}

export async function searchAidboxReferenceResources(
	client: AidboxClientR5,
	type: string,
	query: string,
	signal?: AbortSignal,
) {
	const params = new URLSearchParams({
		_count: "20",
		_sort: "-_lastUpdated",
	});

	if (query.trim()) {
		params.set("_ilike", query.trim());
	}

	return searchAidboxResources<AidboxSearchResource>(
		client,
		type,
		params,
		signal,
	);
}

function searchAidboxParams(
	elements: string,
	query: string,
	extra: Record<string, string> = {},
) {
	const params = new URLSearchParams({
		_count: "20",
		_elements: elements,
		...extra,
	});

	if (query.trim()) {
		params.set("_ilike", query.trim());
	}

	return params;
}

function localTimeToUtc(timeValue: string) {
	if (!timeValue.trim()) {
		return timeValue;
	}

	const today = new Date();
	const datePart = today.toISOString().slice(0, 10);
	const normalizedTime = timeValue.length > 5 ? timeValue : `${timeValue}:00`;
	const localDate = new Date(`${datePart}T${normalizedTime}`);

	if (Number.isNaN(localDate.getTime())) {
		return timeValue;
	}

	return localDate.toISOString().slice(11, 16);
}

function mergedLaunchContext(
	launchContext?: AidboxLaunchContext,
	encounter?: ContextReference,
) {
	return {
		...(launchContext ?? {}),
		...(encounter ? { encounter } : {}),
	} satisfies AidboxLaunchContext;
}

function launchContextParameters(launchContext?: AidboxLaunchContext) {
	return Object.entries(launchContext ?? {}).flatMap(([name, resource]) =>
		resource
			? [
					{
						name: "context",
						part: [
							{
								name: "name",
								valueString: name,
							},
							{
								name: "content",
								valueReference: resource,
							},
						],
					},
				]
			: [],
	);
}

function sharedLinkParameters(params: SharedLinkParams) {
	return [
		...(params.subject
			? [
					{
						name: "subject",
						valueReference: params.subject,
					},
				]
			: []),
		...launchContextParameters(
			mergedLaunchContext(params.launchContext, params.encounter),
		),
		...(params.themeId
			? [
					{
						name: "theme",
						valueString: params.themeId,
					},
				]
			: []),
		...(params.configId
			? [
					{
						name: "config",
						valueString: params.configId,
					},
				]
			: []),
		...(typeof params.allowAmend === "boolean"
			? [
					{
						name: "allow-amend",
						valueBoolean: params.allowAmend,
					},
				]
			: []),
		...(typeof params.allowRepopulate === "boolean"
			? [
					{
						name: "allow-repopulate",
						valueBoolean: params.allowRepopulate,
					},
				]
			: []),
		...(typeof params.readOnly === "boolean"
			? [
					{
						name: "read-only",
						valueBoolean: params.readOnly,
					},
				]
			: []),
		...(params.redirectOnSubmit?.trim()
			? [
					{
						name: "redirect-on-submit",
						valueString: params.redirectOnSubmit.trim(),
					},
				]
			: []),
		...(params.redirectOnSave?.trim()
			? [
					{
						name: "redirect-on-save",
						valueString: params.redirectOnSave.trim(),
					},
				]
			: []),
		...(params.redirectOnTimeout?.trim()
			? [
					{
						name: "redirect-on-timeout",
						valueString: params.redirectOnTimeout.trim(),
					},
				]
			: []),
		...(typeof params.sessionTimeout === "number"
			? [
					{
						name: "session-timeout",
						valueInteger: params.sessionTimeout * 60 * 1000,
					},
				]
			: []),
		...(typeof params.warningTimeout === "number"
			? [
					{
						name: "warning-timeout",
						valueInteger: params.warningTimeout * 60 * 1000,
					},
				]
			: []),
	];
}

function sendFormBody(params: SendFormParams) {
	return {
		parameter: [
			{
				name: "provider",
				valueString: params.emailProvider,
			},
			...(params.form.resourceType === "PlanDefinition"
				? []
				: [{ name: "questionnaire", valueReference: params.form }]),
			{
				name: "email",
				valueString: params.email,
			},
			{
				name: "deadline-days",
				valueInteger: params.deadlineDays,
			},
			...(params.followUpEnabled
				? [
						{
							name: "follow-up-enabled",
							valueBoolean: true,
						},
						{
							name: "follow-up-delay-days",
							valueInteger: params.followUpDays,
						},
						{
							name: "follow-up-time",
							valueString: localTimeToUtc(params.followUpTime),
						},
					]
				: []),
			...(params.followUpEnabled && params.followUpMessage?.trim()
				? [
						{
							name: "follow-up-message",
							valueString: params.followUpMessage.trim(),
						},
					]
				: []),
			...(params.emailSubject?.trim()
				? [
						{
							name: "email-subject",
							valueString: params.emailSubject.trim(),
						},
					]
				: []),
			...(params.emailMessage?.trim()
				? [
						{
							name: "email-message",
							valueString: params.emailMessage.trim(),
						},
					]
				: []),
			...(params.sendAt
				? [
						{
							name: "send-at",
							valueString: params.sendAt,
						},
					]
				: []),
			...(params.clinicianEmail?.trim()
				? [
						{
							name: "clinician-email",
							valueString: params.clinicianEmail.trim(),
						},
					]
				: []),
			...sharedLinkParameters(params),
		],
		resourceType: "Parameters",
	};
}

function generateFormLinkBody(params: GenerateFormLinkParams) {
	const isPlanDefinition = params.form.resourceType === "PlanDefinition";
	return {
		parameter: [
			...(!isPlanDefinition
				? [{ name: "questionnaireRef", valueReference: params.form }]
				: []),
			...(params.subject
				? [
						{
							name: "local",
							valueBoolean: true,
						},
					]
				: []),
			...(isPlanDefinition && params.encounter
				? [{ name: "encounter", valueReference: params.encounter }]
				: []),
			...sharedLinkParameters(
				isPlanDefinition
					? { ...params, allowRepopulate: undefined, readOnly: undefined }
					: params,
			),
		],
		resourceType: "Parameters",
	};
}

export function formatPatientLabel(patient: Pick<Patient, "id" | "name">) {
	const firstName = patient.name?.[0];
	const composedName = [firstName?.given?.join(" "), firstName?.family]
		.filter(Boolean)
		.join(" ")
		.trim();

	return firstName?.text ?? (composedName || patient.id || "Patient");
}

export function getPatientEmail(patient?: Pick<Patient, "telecom"> | null) {
	return (
		patient?.telecom?.find((contact) => contact.system === "email")?.value ?? ""
	);
}

export function formatEncounterLabel(
	encounter: Pick<Encounter, "id" | "subject">,
) {
	return (
		encounter.id ??
		encounter.subject?.display ??
		encounter.subject?.reference ??
		"Encounter"
	);
}

export function formatAidboxReferenceLabel(resource: AidboxSearchResource) {
	if (resource.resourceType === "Patient") {
		return formatPatientLabel(resource as Pick<Patient, "id" | "name">);
	}

	if (resource.resourceType === "Encounter") {
		return formatEncounterLabel(resource as Pick<Encounter, "id" | "subject">);
	}

	if (typeof resource.name === "string" && resource.name.trim()) {
		return resource.name.trim();
	}

	if (Array.isArray(resource.name)) {
		const firstName = resource.name[0];
		const composedName = [firstName?.given?.join(" "), firstName?.family]
			.filter(Boolean)
			.join(" ")
			.trim();

		if (firstName?.text?.trim()) {
			return firstName.text.trim();
		}

		if (composedName) {
			return composedName;
		}
	}

	if (resource.title?.trim()) {
		return resource.title.trim();
	}

	if (resource.subject?.display?.trim()) {
		return resource.subject.display.trim();
	}

	if (resource.subject?.reference?.trim()) {
		return resource.subject.reference.trim();
	}

	return resource.id ?? resource.resourceType;
}

export function usePatients(query: string, enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["send-form", "patients", query],
		queryFn: ({ signal }) =>
			searchAidboxResources<Patient>(
				client,
				"Patient",
				searchAidboxParams("id,name,telecom,birthDate", query, {
					_sort: "-_lastUpdated",
				}),
				signal,
			),
		enabled,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
	});
}

export function useEncounters(query: string, enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["send-form", "encounters", query],
		queryFn: ({ signal }) =>
			searchAidboxResources<Encounter>(
				client,
				"Encounter",
				searchAidboxParams("id,subject,meta", query, {
					_sort: "-_lastUpdated",
				}),
				signal,
			),
		enabled,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
	});
}

export function useSendForm() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: SendFormParams) => {
			const response = await boxRequest(
				client,
				{
					method: "POST",
					url:
						params.form.resourceType === "PlanDefinition"
							? `/fhir/PlanDefinition/${encodeURIComponent(params.form.id)}/$sdc-send`
							: "/fhir/Questionnaire/$send",
					body: JSON.stringify(sendFormBody(params)),
				},
				"Failed to start form-sending process",
			);

			const rawBody = await response.text();

			if (!rawBody) {
				return null;
			}

			try {
				return JSON.parse(rawBody);
			} catch {
				return rawBody;
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponseWorkflows"],
			});
		},
	});
}

export function useGenerateFormLink() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: GenerateFormLinkParams) => {
			const body = await boxJson<{
				parameter?: Array<{ name?: string; valueUri?: string }>;
			}>(
				client,
				{
					method: "POST",
					url:
						params.form.resourceType === "PlanDefinition"
							? `/fhir/PlanDefinition/${encodeURIComponent(params.form.id)}/$sdc-start-link`
							: `/fhir/Questionnaire/${encodeURIComponent(params.form.id)}/$populatelink`,
					body: JSON.stringify(generateFormLinkBody(params)),
				},
				"Failed to generate form link",
			);
			const link = body.parameter?.find(
				(parameter) => parameter.name === "link",
			)?.valueUri;

			if (!link) {
				throw new Error("Generated link response is missing link");
			}

			return link;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
		},
	});
}

/**
 * Shares a form with the child organizations (`shared`), with every organization
 * (`system-shared`), or takes the sharing back (`null`).
 *
 * Patches the Questionnaire or PlanDefinition in the current scope: the box
 * derives who may change the sharing from the request path.
 */
export function useShareForm() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			mode,
			form,
		}: {
			mode: ShareMode | null;
			form: Form;
		}) => {
			if (!form.id) {
				throw new Error("Form id is required");
			}

			await boxRequest(
				client,
				{
					method: "PATCH",
					url: `/sdc/${form.resourceType}/${encodeURIComponent(form.id)}`,
					body: JSON.stringify(buildShareModePatch(form, mode)),
				},
				"Failed to change form sharing",
			);

			return form;
		},
		onSuccess: (form) => {
			void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
			if (form.resourceType === "PlanDefinition") {
				void queryClient.invalidateQueries({ queryKey: ["planDefinitions"] });
				void queryClient.invalidateQueries({
					queryKey: ["planDefinition", form.id],
				});
			}
		},
	});
}
