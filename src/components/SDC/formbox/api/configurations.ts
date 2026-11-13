import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type {
	QuestionnaireTheme,
	SDCConfig,
} from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4";
import { useQuery } from "@tanstack/react-query";
import { boxJson } from "../../shared/http";
import { humanize } from "../utils";

const CONFIGURATIONS_QUERY_KEY = ["sdc-configurations"] as const;
const QUESTIONNAIRE_THEMES_QUERY_KEY = ["questionnaire-themes"] as const;
const CONFIGURATION_REFERENCES_QUERY_KEY = [
	...CONFIGURATIONS_QUERY_KEY,
	"references",
] as const;
const STORAGE_ACCOUNT_REFERENCES_QUERY_KEY = [
	"storage-account-references",
] as const;
const CONFIGURATION_RESOURCE_TYPE = "SDCConfig";
const QUESTIONNAIRE_THEME_RESOURCE_TYPE = "QuestionnaireTheme";
const CONFIGURATION_FILTER_PAGE_SIZE = 200;
const STORAGE_ACCOUNT_RESOURCE_TYPES = [
	"AwsAccount",
	"GcpServiceAccount",
	"AzureContainer",
] as const;

type StorageAccountReferenceOption = {
	label: string;
	value: string;
};

function bundleResources<T extends Resource>(
	bundle: Bundle,
	resourceType: T["resourceType"] | string,
) {
	return (
		bundle.entry?.flatMap((entry) => {
			const resource = entry.resource as T | undefined;
			return resource?.resourceType === resourceType ? [resource] : [];
		}) ?? []
	);
}

async function fetchFhirBundle(client: AidboxClientR5, resourceType: string) {
	return boxJson<Bundle>(
		client,
		{
			method: "GET",
			url: `/fhir/${resourceType}`,
			params: [
				["_count", String(CONFIGURATION_FILTER_PAGE_SIZE)],
				["_sort", "-_lastUpdated"],
			],
		},
		`Failed to fetch ${resourceType}`,
	);
}

async function fetchQuestionnaireThemes(client: AidboxClientR5) {
	const bundle = await fetchFhirBundle(
		client,
		QUESTIONNAIRE_THEME_RESOURCE_TYPE,
	);

	return bundleResources<QuestionnaireTheme>(
		bundle,
		QUESTIONNAIRE_THEME_RESOURCE_TYPE,
	).sort((left, right) =>
		getQuestionnaireThemeLabel(left).localeCompare(
			getQuestionnaireThemeLabel(right),
		),
	);
}

async function fetchConfigurationReferences(client: AidboxClientR5) {
	const bundle = await fetchFhirBundle(client, CONFIGURATION_RESOURCE_TYPE);

	return bundleResources<SDCConfig>(bundle, CONFIGURATION_RESOURCE_TYPE).sort(
		(left, right) =>
			getConfigurationLabel(left).localeCompare(getConfigurationLabel(right)),
	);
}

async function fetchStorageAccountReferences(client: AidboxClientR5) {
	const bundles = await Promise.all(
		STORAGE_ACCOUNT_RESOURCE_TYPES.map((resourceType) =>
			fetchFhirBundle(client, resourceType),
		),
	);

	return bundles
		.flatMap((bundle, index) => {
			const resourceType = STORAGE_ACCOUNT_RESOURCE_TYPES[index];

			return (
				bundle.entry?.flatMap((entry) => {
					const resource = entry.resource as
						| {
								id?: string;
								name?: unknown;
								resourceType?: string;
						  }
						| undefined;

					if (!resource?.id) {
						return [];
					}

					const name =
						typeof resource.name === "string" ? resource.name.trim() : "";
					const typeLabel = humanize(resource.resourceType ?? resourceType);

					return [
						{
							label: name
								? `${name} (${typeLabel})`
								: `${resource.id} (${typeLabel})`,
							value: `${resourceType}/${resource.id}`,
						} satisfies StorageAccountReferenceOption,
					];
				}) ?? []
			);
		})
		.sort((left, right) => left.label.localeCompare(right.label));
}

export function getConfigurationLabel(
	configuration: Pick<SDCConfig, "id"> & Partial<Pick<SDCConfig, "name">>,
) {
	return configuration.name ?? configuration.id ?? "Untitled configuration";
}

export function getQuestionnaireThemeLabel(
	theme: Pick<QuestionnaireTheme, "id" | "theme-name">,
) {
	return theme["theme-name"] ?? theme.id ?? "Untitled theme";
}

export function useQuestionnaireThemes(enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: QUESTIONNAIRE_THEMES_QUERY_KEY,
		queryFn: () => fetchQuestionnaireThemes(client),
		enabled,
	});
}

export function useConfigurationReferences(enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: CONFIGURATION_REFERENCES_QUERY_KEY,
		queryFn: () => fetchConfigurationReferences(client),
		enabled,
	});
}

export function useStorageAccountReferences() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: STORAGE_ACCOUNT_REFERENCES_QUERY_KEY,
		queryFn: () => fetchStorageAccountReferences(client),
	});
}
