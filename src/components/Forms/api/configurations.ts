import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import type {
	QuestionnaireTheme,
	SDCConfig,
} from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4/index";
import { resourceOf } from "@aidbox-ui/utils/http";
import { useQuery } from "@tanstack/react-query";

const CONFIGURATIONS_QUERY_KEY = ["sdc-configurations"] as const;
const QUESTIONNAIRE_THEMES_QUERY_KEY = ["questionnaire-themes"] as const;
const CONFIGURATION_REFERENCES_QUERY_KEY = [
	...CONFIGURATIONS_QUERY_KEY,
	"references",
] as const;
const CONFIGURATION_RESOURCE_TYPE = "SDCConfig";
const QUESTIONNAIRE_THEME_RESOURCE_TYPE = "QuestionnaireTheme";
const CONFIGURATION_FILTER_PAGE_SIZE = 200;

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
	return resourceOf(
		client.request<Bundle>({
			method: "GET",
			url: `/fhir/${resourceType}`,
			params: [
				["_count", String(CONFIGURATION_FILTER_PAGE_SIZE)],
				["_sort", "-_lastUpdated"],
			],
		}),
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
