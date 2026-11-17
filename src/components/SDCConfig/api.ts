import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core/index";
import type { QuestionnaireTheme } from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4/index";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 200;

const STORAGE_ACCOUNT_RESOURCE_TYPES = [
	"AwsAccount",
	"GcpServiceAccount",
	"AzureContainer",
] as const;

type ReferenceOption = {
	label: string;
	value: string;
};

type NamedResource = {
	id?: string;
	name?: unknown;
	resourceType?: string;
};

function humanize(value: string) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

async function fetchResources<T>(
	client: AidboxClientR5,
	resourceType: string,
): Promise<T[]> {
	const result = await client.request<Bundle>({
		method: "GET",
		url: `/fhir/${resourceType}`,
		params: [
			["_count", String(PAGE_SIZE)],
			["_sort", "-_lastUpdated"],
		],
	});
	if (!result.isOk()) throw new Error(`Failed to fetch ${resourceType}`);
	return (result.value.resource.entry ?? []).flatMap((entry) =>
		entry.resource?.resourceType === resourceType
			? [entry.resource as unknown as T]
			: [],
	);
}

function nameOf(resource: NamedResource) {
	return typeof resource.name === "string" ? resource.name.trim() : "";
}

const byLabel = (left: ReferenceOption, right: ReferenceOption) =>
	left.label.localeCompare(right.label);

export function getQuestionnaireThemeLabel(
	theme: Pick<QuestionnaireTheme, "id" | "theme-name">,
) {
	return theme["theme-name"] ?? theme.id ?? "Untitled theme";
}

export function useQuestionnaireThemes() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["sdc-config", "questionnaire-themes"],
		queryFn: async () =>
			(
				await fetchResources<QuestionnaireTheme>(client, "QuestionnaireTheme")
			).sort((left, right) =>
				getQuestionnaireThemeLabel(left).localeCompare(
					getQuestionnaireThemeLabel(right),
				),
			),
	});
}

/**
 * Cloud storage accounts a configuration can point at. A box without one of
 * these resource types still lists the others.
 */
export function useStorageAccountReferences() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["sdc-config", "storage-account-references"],
		queryFn: async () => {
			const lists = await Promise.all(
				STORAGE_ACCOUNT_RESOURCE_TYPES.map((resourceType) =>
					fetchResources<NamedResource>(client, resourceType).catch(
						() => [] as NamedResource[],
					),
				),
			);
			return lists
				.flatMap((resources, index) => {
					const resourceType = STORAGE_ACCOUNT_RESOURCE_TYPES[index] ?? "";
					const typeLabel = humanize(resourceType);
					return resources.flatMap((resource) =>
						resource.id
							? [
									{
										label: `${nameOf(resource) || resource.id} (${typeLabel})`,
										value: `${resourceType}/${resource.id}`,
									},
								]
							: [],
					);
				})
				.sort(byLabel);
		},
	});
}
