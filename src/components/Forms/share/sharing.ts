import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import { useQuery } from "@tanstack/react-query";

const ORGBAC_SETTING_NAME = "security.orgbac.enabled";
const ENABLED_SETTING_VALUES = new Set(["true", "enable", "enabled"]);
const TENANT_ORGANIZATION_EXTENSION_URL =
	"https://aidbox.app/tenant-organization-id";
const TENANT_RESOURCE_MODE_EXTENSION_URL =
	"https://aidbox.app/tenant-resource-mode";

/** Visible to the organization's children (`shared`) or to all of them. */
export type ShareMode = "shared" | "system-shared";

/**
 * A `meta.extension` entry. Polymorphic values arrive in FHIR format
 * (`valueReference`) from the FHIR API and in Aidbox format (`value.Reference`)
 * from the native one, so both shapes are read.
 */
type MetaExtension = {
	url?: string;
	value?: {
		Reference?: { id?: string; reference?: string };
		string?: string;
	};
	valueReference?: { id?: string; reference?: string };
	valueString?: string;
};

/**
 * Any resource. `meta` is `unknown` on purpose: the generated FHIR types drop
 * extensions, so `meta.extension` has to be read through a cast anyway.
 */
type ResourceWithMeta = { meta?: unknown };

function getMetaExtensions(resource: ResourceWithMeta | undefined) {
	return (resource?.meta as { extension?: MetaExtension[] } | undefined)
		?.extension;
}

function findMetaExtension(
	resource: ResourceWithMeta | undefined,
	url: string,
) {
	return getMetaExtensions(resource)?.find(
		(extension) => extension.url === url,
	);
}

/**
 * Organization the resource belongs to, `null` for a root-level resource.
 *
 * Port of `resource-owner` / `resource-owned-by?`
 * (`src-c/sdc/forms/mtc/utils.cljc`).
 */
export function getResourceOrganizationId(
	resource: ResourceWithMeta | undefined,
): string | null {
	const extension = findMetaExtension(
		resource,
		TENANT_ORGANIZATION_EXTENSION_URL,
	);
	const reference = extension?.value?.Reference ?? extension?.valueReference;

	return reference?.id ?? reference?.reference?.split("/").pop() ?? null;
}

/** Port of `resource-mode` (`src-c/sdc/forms/mtc/utils.cljc`). */
export function getResourceShareMode(
	resource: ResourceWithMeta | undefined,
): ShareMode | null {
	const extension = findMetaExtension(
		resource,
		TENANT_RESOURCE_MODE_EXTENSION_URL,
	);
	const mode = extension?.value?.string ?? extension?.valueString;

	return mode === "shared" || mode === "system-shared" ? mode : null;
}

/**
 * Body of the merge `PATCH` that shares or unshares a resource.
 *
 * The box merges maps but replaces arrays, so the whole `meta.extension` array
 * goes out with the share mode swapped — that is what keeps the
 * organization-owner extension intact. An empty array is sent as `null`, which
 * drops the key instead of storing `"extension": []`.
 *
 * Port of `::make-shared` / `::make-system-shared` / `::unshare`
 * (`src-ui/sdc/forms/mtc.cljc`).
 *
 * Verified by hand on a box with orgbac: the grid reads the resource from `/fhir`
 * (so extensions arrive in FHIR format), this patch goes to `/sdc`, and after a
 * share → unshare → share round trip the owner extension is still there in the
 * same format. Sharing globally a resource that belongs to an organization is
 * refused by the box with 403, which is why the menu hides that combination.
 */
export function buildShareModePatch(
	resource: ResourceWithMeta,
	mode: ShareMode | null,
) {
	const kept = (getMetaExtensions(resource) ?? []).filter(
		(candidate) => candidate.url !== TENANT_RESOURCE_MODE_EXTENSION_URL,
	);
	const extension = mode
		? [...kept, { url: TENANT_RESOURCE_MODE_EXTENSION_URL, valueString: mode }]
		: kept;

	return { meta: { extension: extension.length > 0 ? extension : null } };
}

/** Whether the box runs organization-based access control. */
export function useOrgbacEnabled(enabled = true) {
	const client = useAidboxClient();

	return useQuery({
		enabled,
		queryKey: ["orgbac-enabled"],
		queryFn: async () => {
			const result = await client.request<{ value?: boolean | string }>({
				method: "GET",
				url: `/api/v1/settings/introspect/${ORGBAC_SETTING_NAME}`,
			});

			// Users who may not introspect settings also may not switch tenants.
			if (!result.isOk()) {
				return false;
			}

			// Introspection reports the raw value, so a boolean setting comes back as
			// `true` from a preset but as a string from an environment variable.
			const { value } = result.value.resource;

			return (
				value === true ||
				(typeof value === "string" &&
					ENABLED_SETTING_VALUES.has(value.trim().toLowerCase()))
			);
		},
		refetchOnWindowFocus: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}
