import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import { useAidboxClient } from "../AidboxClient";
import { fetchResource } from "../components/ResourceEditor/api";
import { pageId as RESOURCE_EDITOR_PAGE_ID } from "../components/ResourceEditor/types";

/**
 * FHIR R5 resources whose top-level data shape descends from
 * `CanonicalResource` — they expose `url`, `name`, `title`, `version`, `status`.
 * Plus SQL-on-FHIR `ViewDefinition` which is also a canonical resource.
 */
export const CANONICAL_RESOURCE_TYPES: ReadonlySet<string> = new Set([
	"ActivityDefinition",
	"ActorDefinition",
	"CapabilityStatement",
	"ChargeItemDefinition",
	"Citation",
	"CodeSystem",
	"CompartmentDefinition",
	"ConceptMap",
	"ConditionDefinition",
	"EventDefinition",
	"Evidence",
	"EvidenceReport",
	"EvidenceVariable",
	"ExampleScenario",
	"GraphDefinition",
	"ImplementationGuide",
	"Library",
	"Measure",
	"MessageDefinition",
	"NamingSystem",
	"ObservationDefinition",
	"OperationDefinition",
	"PlanDefinition",
	"Questionnaire",
	"Requirements",
	"SearchParameter",
	"SpecimenDefinition",
	"StructureDefinition",
	"StructureMap",
	"SubscriptionTopic",
	"TerminologyCapabilities",
	"TestPlan",
	"TestScript",
	"ValueSet",
	"ViewDefinition",
]);

export function isCanonicalResourceType(rt: string): boolean {
	return CANONICAL_RESOURCE_TYPES.has(rt);
}

type DisplayResource = Resource & {
	name?: string;
	title?: string;
};

/**
 * Shared React Query key for a single FHIR resource. ResourceEditorPage uses
 * the same key — any consumer (e.g. Breadcrumbs) reuses the cached resource
 * without an extra network request.
 */
export function resourceQueryKey(
	resourceType: string,
	id: string,
): readonly unknown[] {
	return [RESOURCE_EDITOR_PAGE_ID, resourceType, id];
}

/**
 * Resolves the display label for a canonical resource: `title || name || id`.
 * Returns `display=null` while the resource is loading so callers can render
 * a skeleton; falls back to `id` on failure. Shares the cache with
 * ResourceEditorPage, so the same network request is not repeated.
 */
export function useCanonicalDisplay(
	resourceType: string | null,
	id: string | null,
): { display: string | null; isLoading: boolean } {
	const client = useAidboxClient();
	const enabled =
		!!resourceType && !!id && isCanonicalResourceType(resourceType);
	const { data, isLoading, isFetching } = useQuery<Resource>({
		queryKey:
			resourceType && id
				? resourceQueryKey(resourceType, id)
				: ["__canonical-display-skip__"],
		enabled,
		queryFn: () => fetchResource(client, resourceType as string, id as string),
		staleTime: 60_000,
	});
	if (!enabled) {
		return { display: null, isLoading: false };
	}
	if (data) {
		const r = data as DisplayResource;
		return {
			display: r.title || r.name || r.id || id || "",
			isLoading: false,
		};
	}
	return { display: null, isLoading: isLoading || isFetching };
}
