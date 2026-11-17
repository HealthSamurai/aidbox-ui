import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import { useLocalStorage } from "@aidbox-ui/hooks/index";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

/** `PlanDefinition.type` of an SDC package of forms. */
const PLAN_DEFINITION_TYPE =
	"http://health-samurai.io/fhir/sdc/CodeSystem/plan-definition-type|plan-definition";
const ASSEMBLE_EXPECTATION_URL =
	"http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assemble-expectation";
const TENANT_ORGANIZATION_URL = "https://aidbox.app/tenant-organization-id";
const TENANT_RESOURCE_MODE_URL = "https://aidbox.app/tenant-resource-mode";
/**
 * Formbox's key: Aidbox UI is served from the same origin, so a form pinned in
 * one is pinned in the other.
 */
const PINNED_FORMS_STORAGE_KEY = "formbox:pinned-questionnaires";
/** The box caps a search page at this many entries. */
const MAX_PAGE_SIZE = 100;

/**
 * A `meta.extension` entry. Polymorphic values arrive in FHIR format
 * (`valueReference`) from the FHIR API and in Aidbox format (`value.Reference`)
 * from the native one, so both shapes are read.
 */
type MetaExtension = {
	url?: string;
	value?: { Reference?: { id?: string; reference?: string }; string?: string };
	valueReference?: { id?: string; reference?: string };
	valueString?: string;
};

type FormMeta = { lastUpdated?: string; extension?: MetaExtension[] };

type FormFields = {
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	status?: string;
	publisher?: string;
	meta?: FormMeta;
};

export type FormQuestionnaire = FormFields & {
	resourceType: "Questionnaire";
	extension?: Array<{ url?: string; valueCode?: string }>;
};

export type PlanDefinitionAction = {
	id?: string;
	title?: string;
	definitionCanonical?: string;
};

/** A package: a PlanDefinition whose actions are the forms in it. */
export type FormPlanDefinition = FormFields & {
	resourceType: "PlanDefinition";
	action?: PlanDefinitionAction[];
};

export type Form = FormQuestionnaire | FormPlanDefinition;

const FORM_KIND_LABELS = {
	"plan-definition": "Package",
	component: "Component",
	form: "Form",
	"form-component": "Form & Component",
} as const;

export type FormKind = keyof typeof FORM_KIND_LABELS;

export const FORM_KIND_OPTIONS = Object.entries(FORM_KIND_LABELS).map(
	([value, label]) => ({ label, value: value as FormKind }),
);

export function isFormKind(value: string): value is FormKind {
	// `in` would walk the prototype chain and let `?kind=constructor` through.
	return Object.hasOwn(FORM_KIND_LABELS, value);
}

export type UpdatedSort = "asc" | "desc";

export type FormFilters = {
	author?: string;
	kind?: FormKind;
	q?: string;
	status?: string;
	updatedSort?: UpdatedSort;
};

export function getFormLabel(form: Pick<Form, "id" | "name" | "title">) {
	return form.title ?? form.name ?? form.id ?? "Untitled form";
}

/** `Questionnaire/<id>` or `PlanDefinition/<id>`: a row's key and selection id. */
export function getFormKey(form: Form) {
	return `${form.resourceType}/${form.id}`;
}

/**
 * Pins keep Formbox's format: a bare id for a Questionnaire, a reference for a
 * PlanDefinition.
 */
export function getFormPinId(form: Form) {
	return form.resourceType === "PlanDefinition"
		? `PlanDefinition/${form.id}`
		: (form.id ?? "");
}

export function getFormKind(form: Form): FormKind {
	if (form.resourceType === "PlanDefinition") return "plan-definition";
	const expectation = form.extension?.find(
		(extension) => extension.url === ASSEMBLE_EXPECTATION_URL,
	)?.valueCode;
	if (expectation === "assemble-child" || expectation === "independent-child") {
		return "component";
	}
	if (
		expectation === "assemble-root-or-child" ||
		expectation === "independent-root-or-child"
	) {
		return "form-component";
	}
	return "form";
}

export function getFormKindLabel(form: Form) {
	return FORM_KIND_LABELS[getFormKind(form)];
}

function findMetaExtension(form: Form, url: string) {
	return form.meta?.extension?.find((extension) => extension.url === url);
}

/** Organization the form belongs to, `null` for a root-level form. */
export function getFormOrganizationId(form: Form): string | null {
	const extension = findMetaExtension(form, TENANT_ORGANIZATION_URL);
	const reference = extension?.value?.Reference ?? extension?.valueReference;
	return reference?.id ?? reference?.reference?.split("/").pop() ?? null;
}

/** Shared with the owner's child organizations, or with all of them. */
export function getFormShareMode(
	form: Form,
): "shared" | "system-shared" | null {
	const extension = findMetaExtension(form, TENANT_RESOURCE_MODE_URL);
	const mode = extension?.value?.string ?? extension?.valueString;
	return mode === "shared" || mode === "system-shared" ? mode : null;
}

/** The Questionnaire a package action points at, by canonical or reference. */
export function findActionQuestionnaire(
	action: PlanDefinitionAction,
	questionnaires: FormQuestionnaire[],
) {
	const [url, version] = (action.definitionCanonical ?? "").split("|");
	return questionnaires.find(
		(questionnaire) =>
			(questionnaire.url === url ||
				`Questionnaire/${questionnaire.id}` === url) &&
			(!version || questionnaire.version === version),
	);
}

type SearchBundle = {
	total?: number;
	entry?: Array<{ resource?: { resourceType?: string } }>;
	link?: Array<{ relation?: string }>;
};

/**
 * Search the SDC API, following pages until `limit` resources are read: the
 * box caps a page at 100, whatever `_count` asks for.
 */
async function searchResources<T extends Form>(
	client: AidboxClientR5,
	resourceType: T["resourceType"],
	params: Array<[string, string]>,
	limit = Number.POSITIVE_INFINITY,
): Promise<{ resources: T[]; total: number }> {
	const resources: T[] = [];
	let total = 0;
	for (let page = 1; resources.length < limit; page++) {
		const query = params.filter(([name]) => name !== "_page");
		if (!query.some(([name]) => name === "_count")) {
			query.push(["_count", String(MAX_PAGE_SIZE)]);
		}
		query.push(["_page", String(page)]);
		const result = await client.request<SearchBundle>({
			method: "GET",
			url: `/sdc/${resourceType}`,
			params: query,
		});
		if (result.isErr()) throw new Error(`Could not load ${resourceType}`);
		const bundle = result.value.resource;
		const matches = (bundle.entry ?? []).flatMap((entry) =>
			entry.resource?.resourceType === resourceType
				? [entry.resource as T]
				: [],
		);
		resources.push(...matches);
		total = bundle.total ?? resources.length;
		const hasNext = bundle.link?.some((link) => link.relation === "next");
		if (matches.length === 0 || (!hasNext && resources.length >= total)) break;
	}
	return { resources, total };
}

function buildFormsQuery(
	filters: FormFilters,
	pageSize: number,
	excludedIds: string[] = [],
) {
	const query: Array<[string, string]> = [
		["_count", String(pageSize)],
		["_sort", filters.updatedSort === "asc" ? "_lastUpdated" : "-_lastUpdated"],
	];
	// The kind lives in the assemble-expectation extension; the box searches it
	// as `assemble-kind`, so filtering, counting and paging stay server-side.
	if (filters.kind) query.push(["assemble-kind", filters.kind]);
	if (excludedIds.length > 0) query.push(["_id:not", excludedIds.join(",")]);
	if (filters.q) query.push(["_ilike", filters.q]);
	if (filters.status) query.push(["status", filters.status]);
	if (filters.author) query.push(["publisher", filters.author]);
	return query;
}

/** Newest (or oldest) first, then by key, so equal dates keep a stable order. */
function compareByUpdated(direction: UpdatedSort) {
	const sign = direction === "asc" ? 1 : -1;
	return (left: Form, right: Form) =>
		sign *
			(left.meta?.lastUpdated ?? "").localeCompare(
				right.meta?.lastUpdated ?? "",
			) || getFormKey(left).localeCompare(getFormKey(right));
}

export function usePlanDefinitions() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["questionnaires", "sdc-forms", "plan-definitions"],
		queryFn: async () =>
			(
				await searchResources<FormPlanDefinition>(client, "PlanDefinition", [
					["type", PLAN_DEFINITION_TYPE],
				])
			).resources,
		staleTime: 60_000,
	});
}

/**
 * One page of forms: Questionnaires and packages merged into one list, sorted
 * by update date. Both are searched with the same filters, and the page is cut
 * from the merged list, so packages do not distort the paging. Pinned forms are
 * left out: they are shown above the page.
 */
export function useForms(
	filters: FormFilters,
	page: number,
	pageSize: number,
	pinnedIds: string[],
) {
	const client = useAidboxClient();
	const planDefinitions = usePlanDefinitions();
	const query = useQuery({
		queryKey: [
			"questionnaires",
			"sdc-forms",
			"page",
			filters,
			page,
			pageSize,
			pinnedIds,
		],
		enabled: planDefinitions.isSuccess,
		queryFn: async () => {
			const wantsPackages = !filters.kind || filters.kind === "plan-definition";
			const packageIds = new Set(
				(wantsPackages ? (planDefinitions.data ?? []) : [])
					.filter((form) => !pinnedIds.includes(getFormPinId(form)))
					.map((form) => form.id),
			);
			const end = page * pageSize;
			const [questionnaires, packages] = await Promise.all([
				filters.kind === "plan-definition"
					? { resources: [], total: 0 }
					: searchResources<FormQuestionnaire>(
							client,
							"Questionnaire",
							buildFormsQuery(
								filters,
								Math.min(end, MAX_PAGE_SIZE),
								pinnedIds.filter((id) => !id.startsWith("PlanDefinition/")),
							),
							end,
						),
				packageIds.size > 0
					? searchResources<FormPlanDefinition>(client, "PlanDefinition", [
							["type", PLAN_DEFINITION_TYPE],
							...buildFormsQuery(
								{ ...filters, kind: undefined },
								MAX_PAGE_SIZE,
							),
						])
					: { resources: [], total: 0 },
			]);
			const matchingPackages = packages.resources.filter((form) =>
				packageIds.has(form.id),
			);
			const forms: Form[] = [...questionnaires.resources, ...matchingPackages]
				.sort(compareByUpdated(filters.updatedSort ?? "desc"))
				.slice((page - 1) * pageSize, end);
			return {
				forms,
				total: questionnaires.total + matchingPackages.length,
			};
		},
		placeholderData: (previous) => previous,
	});
	return {
		data: query.data,
		isLoading: planDefinitions.isLoading || query.isLoading,
		isError: planDefinitions.isError || query.isError,
	};
}

/** Every Questionnaire, enough of it to fill the rows of an expanded package. */
export function useQuestionnaireCatalog(enabled: boolean) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["questionnaires", "sdc-forms", "questionnaire-catalog"],
		enabled,
		queryFn: async () =>
			(
				await searchResources<FormQuestionnaire>(client, "Questionnaire", [
					[
						"_elements",
						"id,url,version,title,name,status,publisher,meta,extension",
					],
				])
			).resources,
		staleTime: 60_000,
	});
}

/** The authors and statuses the filters offer, from forms and packages alike. */
export function useFormFilterOptions() {
	const client = useAidboxClient();
	const planDefinitions = usePlanDefinitions();
	const questionnaires = useQuery({
		queryKey: ["questionnaires", "sdc-forms", "filter-options"],
		queryFn: async () =>
			(
				await searchResources<FormQuestionnaire>(
					client,
					"Questionnaire",
					[
						["_count", "1000"],
						["_elements", "publisher,status"],
					],
					1000,
				)
			).resources,
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
	});
	const forms: Form[] = [
		...(questionnaires.data ?? []),
		...(planDefinitions.data ?? []),
	];
	const distinct = (values: Array<string | undefined>) =>
		[
			...new Set(values.filter((value): value is string => Boolean(value))),
		].sort((left, right) => left.localeCompare(right));
	return {
		authorOptions: distinct(forms.map((form) => form.publisher)),
		statusOptions: distinct(forms.map((form) => form.status)),
	};
}

export function usePinnedFormIds() {
	const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>({
		key: PINNED_FORMS_STORAGE_KEY,
		defaultValue: [],
		getInitialValueInEffect: false,
	});
	const togglePin = useCallback(
		(id: string) =>
			setPinnedIds((previous) =>
				previous.includes(id)
					? previous.filter((value) => value !== id)
					: [...previous, id],
			),
		[setPinnedIds],
	);
	const removePin = useCallback(
		(id: string) =>
			setPinnedIds((previous) => previous.filter((value) => value !== id)),
		[setPinnedIds],
	);
	return { pinnedIds, togglePin, removePin };
}

/** The pinned forms, in the order they were pinned. */
export function usePinnedForms(pinnedIds: string[]) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["questionnaires", "sdc-forms", "pinned", pinnedIds],
		enabled: pinnedIds.length > 0,
		queryFn: async () => {
			const packageIds = pinnedIds
				.filter((id) => id.startsWith("PlanDefinition/"))
				.map((id) => id.slice("PlanDefinition/".length));
			const questionnaireIds = pinnedIds.filter(
				(id) => !id.startsWith("PlanDefinition/"),
			);
			const [questionnaires, packages] = await Promise.all([
				questionnaireIds.length > 0
					? searchResources<FormQuestionnaire>(client, "Questionnaire", [
							["_id", questionnaireIds.join(",")],
						])
					: { resources: [], total: 0 },
				packageIds.length > 0
					? searchResources<FormPlanDefinition>(client, "PlanDefinition", [
							["_id", packageIds.join(",")],
							["type", PLAN_DEFINITION_TYPE],
						])
					: { resources: [], total: 0 },
			]);
			const byPinId = new Map<string, Form>(
				[...questionnaires.resources, ...packages.resources].map((form) => [
					getFormPinId(form),
					form,
				]),
			);
			return pinnedIds.flatMap((id) => {
				const form = byPinId.get(id);
				return form ? [form] : [];
			});
		},
		placeholderData: (previous) => previous,
	});
}
