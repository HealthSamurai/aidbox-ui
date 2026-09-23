import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { CandidateKind } from "../SQLQueryBuilder/resource-picker";

export const PG_PROFILE =
	"http://health-samurai.io/fhir/core/StructureDefinition/aidboxmaterialization-pgProfile";

/** `table` was withdrawn; the profile now admits only these two. */
export const OBJECT_TYPES = ["view", "materialized-view"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/** What the resource declares its target to be. Must agree with the target itself. */
export const TARGET_TYPES = ["ViewDefinition", "Library"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** PostgreSQL folds an unquoted identifier, so the profile admits only plain ones. */
export const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type MaterializationParameter = {
	name?: string;
	valueString?: string;
	valueCode?: string;
	/** Aidbox stores a chosen type as `{value: {string: "…"}}`; the server reads both. */
	value?: Record<string, unknown>;
};

export type MaterializationResource = Resource & {
	type?: string;
	target?: string;
	parameter?: MaterializationParameter[];
	meta?: { profile?: string[] };
};

export const targetTypeOf = (kind: CandidateKind): TargetType =>
	kind === "ViewDefinition" ? "ViewDefinition" : "Library";

export const parameterValue = (
	resource: MaterializationResource,
	name: string,
): string | undefined => {
	const p = resource.parameter?.find((entry) => entry.name === name);
	if (!p) return undefined;
	if (p.valueString !== undefined) return p.valueString;
	if (p.valueCode !== undefined) return p.valueCode;
	const stored = p.value ? Object.values(p.value)[0] : undefined;
	return typeof stored === "string" ? stored : undefined;
};

/** Writes `name`, dropping the entry when the value is cleared. */
export const withParameter = (
	resource: MaterializationResource,
	name: string,
	value: string | undefined,
	as: "valueString" | "valueCode",
): MaterializationResource => {
	const rest = (resource.parameter ?? []).filter((p) => p.name !== name);
	if (!value) return { ...resource, parameter: rest };
	return { ...resource, parameter: [...rest, { name, [as]: value }] };
};

export const profileOf = (
	resource: MaterializationResource,
): string | undefined => resource.meta?.profile?.[0];

export const withProfile = (
	resource: MaterializationResource,
	url: string,
): MaterializationResource => ({
	...resource,
	meta: { ...resource.meta, profile: [url] },
});

/** Only fills a blank — picking a non-pg profile must not be undone on the next edit. */
export const withDefaultProfile = (
	resource: MaterializationResource,
): MaterializationResource =>
	resource.meta?.profile?.length ? resource : withProfile(resource, PG_PROFILE);
