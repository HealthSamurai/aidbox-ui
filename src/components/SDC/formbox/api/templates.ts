import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	Meta,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boxJson, boxRequest, withFallback } from "../../shared/http";

const LIQUID_TEMPLATE_TOPIC =
	"http://forms.aidbox.io/CodeSystem/library-topic|liquid-template";
const INSTANCE_RENDERING_EXTENSION_URL =
	"http://hl7.org/fhir/StructureDefinition/instance-rendering";
const LIBRARY_CANONICAL_PREFIX = "http://forms.aidbox.io/Library/";

export type TemplateFilters = {
	q?: string;
};

export type LiquidTemplateLibrary = {
	id?: string;
	meta?: Meta;
	name?: string;
	resourceType: "Library";
	status?: string;
	title?: string;
	url?: string;
};

type TemplatesPage = {
	templates: LiquidTemplateLibrary[];
	total: number;
};

export type TemplateFormReference = {
	id: string;
	label: string;
};

export type TemplateUsage = {
	forms: TemplateFormReference[];
	purposes: string[];
};

type QuestionnaireWithRenderingExtensions = Questionnaire & {
	extension?: Array<{
		extension?: Array<{
			url?: string;
			valueCanonical?: string;
			valueCoding?: { code?: string };
			valueReference?: { reference?: string };
		}>;
		url?: string;
		valueString?: string;
	}>;
};

function buildTemplatesQuery(
	filters: TemplateFilters,
	page: number,
	pageSize: number,
) {
	const query: Array<[string, string]> = [
		["_count", String(pageSize)],
		["_page", String(page)],
		["_sort", "-_lastUpdated"],
		["topic", LIQUID_TEMPLATE_TOPIC],
		["_elements", "id,name,title,url,status,meta,topic"],
	];

	if (filters.q) {
		query.push(["_ilike", filters.q]);
	}

	return query;
}

function renderingExtensionTarget(
	extension: NonNullable<
		QuestionnaireWithRenderingExtensions["extension"]
	>[number],
) {
	if (extension.url !== INSTANCE_RENDERING_EXTENSION_URL) {
		return undefined;
	}

	const template = extension.extension?.find(
		(entry) => entry.url === "template",
	);
	const canonical = template?.valueCanonical;
	const reference = template?.valueReference?.reference;
	const templateId = canonical?.startsWith(LIBRARY_CANONICAL_PREFIX)
		? canonical.slice(LIBRARY_CANONICAL_PREFIX.length)
		: reference?.startsWith("#")
			? reference.slice(1)
			: undefined;

	if (!templateId) {
		return undefined;
	}

	// a template keeps no purpose of its own: it is how the form points at it
	const purpose = extension.extension?.find((entry) => entry.url === "purpose")
		?.valueCoding?.code;

	return { purpose, templateId };
}

function questionnaireLabel(questionnaire: Questionnaire) {
	return (
		questionnaire.title ??
		questionnaire.name ??
		questionnaire.id ??
		"Untitled form"
	);
}

async function fetchTemplates(
	client: AidboxClientR5,
	filters: TemplateFilters,
	page: number,
	pageSize: number,
) {
	const bundle = await boxJson<Bundle>(
		client,
		{
			method: "GET",
			url: "/fhir/Library",
			params: buildTemplatesQuery(filters, page, pageSize),
		},
		"Failed to fetch templates",
	);

	return {
		templates:
			bundle.entry?.flatMap((entry) => {
				const resource = entry.resource as LiquidTemplateLibrary | undefined;
				return resource?.resourceType === "Library" ? [resource] : [];
			}) ?? [],
		total: bundle.total ?? 0,
	} satisfies TemplatesPage;
}

async function fetchTemplateUsage(client: AidboxClientR5) {
	const bundle = await boxJson<Bundle>(
		client,
		{
			method: "GET",
			url: "/fhir/Questionnaire",
			params: [
				["_count", "1000"],
				["_elements", "id,title,name,extension"],
			],
		},
		"Failed to fetch template usage",
	);
	const usage = new Map<string, TemplateUsage>();

	for (const entry of bundle.entry ?? []) {
		const questionnaire = entry.resource as
			| QuestionnaireWithRenderingExtensions
			| undefined;

		if (questionnaire?.resourceType !== "Questionnaire" || !questionnaire.id) {
			continue;
		}

		for (const extension of questionnaire.extension ?? []) {
			const target = renderingExtensionTarget(extension);

			if (!target) {
				continue;
			}

			const current = usage.get(target.templateId) ?? {
				forms: [],
				purposes: [],
			};

			current.forms.push({
				id: questionnaire.id,
				label: questionnaireLabel(questionnaire),
			});

			if (target.purpose && !current.purposes.includes(target.purpose)) {
				current.purposes.push(target.purpose);
			}

			usage.set(target.templateId, current);
		}
	}

	return usage;
}

export function getTemplateLabel(template: LiquidTemplateLibrary) {
	return template.title?.trim() || template.name?.trim() || "Untitled template";
}

export function useLiquidTemplates(
	filters: TemplateFilters = {},
	page = 1,
	pageSize = 20,
) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["liquid-templates", filters, page, pageSize],
		queryFn: () => fetchTemplates(client, filters, page, pageSize),
		placeholderData: (previousData) => previousData,
	});
}

export function useTemplateUsage() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["liquid-templates", "usage"],
		queryFn: () => fetchTemplateUsage(client),
		staleTime: 60_000,
	});
}

/** Delete one or many Libraries atomically; linked Questionnaires are kept. */
async function deleteLiquidTemplates(
	client: AidboxClientR5,
	templateIds: string[],
) {
	await boxRequest(
		client,
		{
			method: "POST",
			url: "/fhir",
			body: JSON.stringify({
				resourceType: "Bundle",
				type: "transaction",
				entry: templateIds.map((templateId) => ({
					request: {
						method: "DELETE",
						url: `Library/${encodeURIComponent(templateId)}`,
					},
				})),
			}),
		},
		templateIds.length === 1
			? "Failed to delete the template"
			: "Failed to delete the templates",
	);

	return templateIds;
}

export function useDeleteLiquidTemplates() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (templateIds: string[]) =>
			deleteLiquidTemplates(client, templateIds),
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: ["liquid-templates"] });
		},
	});
}

export type QuestionnaireTemplate = {
	purpose: string;
	templateId: string;
};

export function questionnaireTemplates(
	questionnaire: QuestionnaireWithRenderingExtensions,
): QuestionnaireTemplate[] {
	const templates: QuestionnaireTemplate[] = [];

	for (const extension of questionnaire.extension ?? []) {
		const target = renderingExtensionTarget(extension);

		if (target?.purpose) {
			templates.push({
				purpose: target.purpose,
				templateId: target.templateId,
			});
		}
	}

	return templates;
}

async function renderQuestionnaire(
	client: AidboxClientR5,
	questionnaire: Questionnaire,
	purpose: string,
) {
	// not under /fhir: the operation is registered as POST /QuestionnaireResponse/$render,
	// see box.sdc.fhir.manifest
	const params = {
		method: "POST" as const,
		url: "/QuestionnaireResponse/$render",
		// the rendered HTML, sent as is; the client would ask for JSON by default
		headers: { accept: "*/*" },
		body: JSON.stringify({
			parameter: [
				{ name: "purpose", valueString: purpose },
				{ name: "questionnaire", resource: questionnaire },
				{
					name: "questionnaire-response",
					// the grid has no answers to render, so the template is shown against
					// an empty response — enough to see how it lays out
					resource: {
						id: questionnaire.id ?? "preview",
						resourceType: "QuestionnaireResponse",
						status: "in-progress",
					},
				},
			],
			resourceType: "Parameters",
		}),
	};
	const response = await boxRequest(
		client,
		params,
		"Failed to render the template",
	);
	return response.text();
}

export function useRenderedQuestionnaire(
	questionnaire: Questionnaire | null,
	purpose: string | null,
) {
	const client = useAidboxClient();
	return useQuery({
		enabled: Boolean(questionnaire && purpose),
		queryFn: () => {
			if (!questionnaire || !purpose) {
				throw new Error("Nothing to render");
			}

			return renderQuestionnaire(client, questionnaire, purpose);
		},
		queryKey: ["questionnaire-render", questionnaire?.id, purpose],
	});
}

async function fetchTemplateNames(client: AidboxClientR5, ids: string[]) {
	const names = new Map<string, string>();

	// one read each: Aidbox does not answer a comma-separated `_id`
	await Promise.all(
		ids.map(async (id) => {
			// a template that is gone or unreadable keeps its id as the label
			const library = await withFallback<LiquidTemplateLibrary | undefined>(
				boxJson<LiquidTemplateLibrary>(
					client,
					{
						method: "GET",
						url: `/fhir/Library/${encodeURIComponent(id)}`,
						params: [["_elements", "id,name,title"]],
					},
					"Failed to fetch the template",
				),
				undefined,
			);
			if (library) names.set(id, getTemplateLabel(library));
		}),
	);

	return names;
}

export function useTemplateNames(ids: string[]) {
	const key = [...ids].sort().join(",");
	const client = useAidboxClient();

	return useQuery({
		enabled: ids.length > 0,
		queryFn: () => fetchTemplateNames(client, ids),
		queryKey: ["liquid-templates", "names", key],
		staleTime: 60_000,
	});
}
