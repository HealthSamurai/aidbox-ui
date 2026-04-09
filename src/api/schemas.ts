import type { AidboxClientR5 } from "../AidboxClient";
import type { Snapshot } from "../components/ViewDefinition/types";

export type FhirSchema = {
	elements: Record<string, unknown>;
	url: string;
	name: string;
	version: string;
	derivation?: string;
};

export interface Schema {
	differential?: Array<Snapshot>;
	snapshot?: Array<Snapshot>;
	entity: FhirSchema;
	"default?": boolean;
	"package-coordinate": string;
}

export interface SchemaData {
	result: Record<string, Schema>;
}

interface PackageEntry {
	name: string;
	version: string;
}

interface PackageEntitiesResult {
	result: {
		entry: Array<{ resource: FhirSchema }>;
	};
}

async function fetchPackages(client: AidboxClientR5): Promise<PackageEntry[]> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.profiles/list-packages",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.profiles/list-packages",
			params: {},
		}),
	});
	const json = await response.response.json();
	const data: PackageEntry[] = json.result ?? json.data ?? [];
	return data;
}

async function fetchPackageProfiles(
	client: AidboxClientR5,
	packageCoordinate: string,
	resourceType: string,
): Promise<Array<{ resource: FhirSchema }>> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-package-entities",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.introspector/get-package-entities",
			params: {
				"package-coordinate": packageCoordinate,
				"resource-type": "StructureDefinition",
				type: { eq: resourceType },
				count: 100,
			},
		}),
	});
	const json: PackageEntitiesResult = await response.response.json();
	return json.result?.entry ?? [];
}

export const fetchSchemas = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Record<string, Schema> | undefined> => {
	const packages = await fetchPackages(client);
	if (!packages || packages.length === 0) return undefined;

	const results = await Promise.all(
		packages.map(async (pkg) => {
			const pkgCoord = `${pkg.name}#${pkg.version}`;
			const entries = await fetchPackageProfiles(
				client,
				pkgCoord,
				resourceType,
			);
			return { pkgCoord, entries };
		}),
	);

	const schemas: Record<string, Schema> = {};
	for (const { pkgCoord, entries } of results) {
		for (const { resource } of entries) {
			const id = resource.url ?? resource.name;
			schemas[id] = {
				entity: resource,
				"default?": resource.derivation === "specialization",
				"package-coordinate": pkgCoord,
			};
		}
	}

	if (Object.keys(schemas).length === 0) return undefined;
	return schemas;
};

export async function fetchProfileElements(
	client: AidboxClientR5,
	method: string,
	packageCoordinate: string,
	url: string,
): Promise<Array<Snapshot>> {
	const response = await client.rawRequest({
		method: "POST",
		url: `/rpc?_m=${method}`,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method,
			params: {
				"package-coordinate": packageCoordinate,
				url,
			},
		}),
	});
	const json = await response.response.json();
	return json.result?.elements ?? json.data?.elements ?? [];
}
