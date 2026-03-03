import type {
	FhirStructure,
	TreeViewItem,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useAidboxClient } from "../../AidboxClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnapshotElement {
	type: string | null;
	lvl: number;
	name: string;
	path?: string;
	short?: string;
	desc?: string;
	id: string;
	"union?"?: boolean;
	min?: number | string;
	max?: number | string;
	datatype?: string;
	flags?: string[];
	"extension-url"?: string;
	"extension-coordinate"?: { label: string };
	binding?: { strength: string; valueSet: string };
	"vs-coordinate"?: {
		label: string;
		id: string;
		"package-spec": { name: string; version: string };
	};
}

interface ExpansionConcept {
	system?: string;
	code?: string;
	display?: string;
}

// ---------------------------------------------------------------------------
// Tree transformation (flat RPC elements → TreeViewItem<FhirStructure>)
// ---------------------------------------------------------------------------

function getDisplayName(
	element: SnapshotElement,
	path: string,
	isUnion: boolean,
): string {
	const parts = path.split(".");
	const name = element.name || parts.at(-1) || "";
	return isUnion && !name.includes("[x]") ? `${name}[x]` : name;
}

function buildMeta(element: SnapshotElement, isUnion: boolean): FhirStructure {
	const meta: FhirStructure = {};

	if (element.min != null) meta.min = String(element.min);
	if (element.max != null)
		meta.max = element.max === "*" ? "*" : String(element.max);

	if (element.short) meta.short = element.short;
	if (element.desc) meta.desc = element.desc;

	if (isUnion) {
		meta.type = "union";
	} else if (element.datatype) {
		meta.type = element.datatype;
	} else if (element.type === "complex") {
		meta.type = element.datatype || "BackboneElement";
	} else if (element.type) {
		meta.type = element.type;
	}

	if (element.flags) {
		meta.isSummary = element.flags.includes("summary");
		meta.isModifier = element.flags.includes("modifier");
		meta.mustSupport = element.flags.includes("mustSupport");
	}

	if (element["extension-url"]) meta.extensionUrl = element["extension-url"];
	if (element["extension-coordinate"])
		meta.extensionCoordinate = element["extension-coordinate"];
	if (element.binding) meta.binding = element.binding;
	if (element["vs-coordinate"]) meta.vsCoordinate = element["vs-coordinate"];

	return meta;
}

function findUnionParent(
	data: SnapshotElement[],
	path: string,
	lastPart: string,
): string | null {
	const parts = path.split(".");
	for (const el of data) {
		if (!el["union?"] || !el.path) continue;
		const unionName = el.path.split(".").at(-1);
		if (!unionName) continue;
		if (
			lastPart.startsWith(unionName) &&
			lastPart !== unionName &&
			el.path === `${parts.slice(0, -1).join(".")}.${unionName}`
		) {
			return el.path;
		}
	}
	return null;
}

function addChild(
	map: Record<string, string[]>,
	parent: string,
	child: string,
) {
	if (!map[parent]) map[parent] = [];
	if (!map[parent].includes(child)) map[parent].push(child);
}

function transformElementsToTree(
	data: SnapshotElement[] | undefined,
): Record<string, TreeViewItem<FhirStructure>> {
	if (!data || data.length === 0) return {};

	const tree: Record<string, TreeViewItem<FhirStructure>> = {};
	const childrenMap: Record<string, string[]> = {};

	// Create nodes
	for (const element of data) {
		if (element.type === "root" || !element.path) continue;
		const path = element.path;
		const isUnion = element["union?"] === true;
		tree[path] = {
			name: getDisplayName(element, path, isUnion),
			meta: buildMeta(element, isUnion),
		};
	}

	// Build parent-child relationships
	for (const element of data) {
		if (element.type === "root" || !element.path) continue;
		const path = element.path;
		const parts = path.split(".");
		const lastPart = parts.at(-1);
		if (!lastPart) continue;

		const unionParent = findUnionParent(data, path, lastPart);
		if (unionParent) {
			addChild(childrenMap, unionParent, path);
		} else {
			addChild(childrenMap, parts.slice(0, -1).join("."), path);
		}
	}

	// Attach children and mark last nodes
	for (const [parentPath, children] of Object.entries(childrenMap)) {
		const parentNode = tree[parentPath];
		if (!parentNode || children.length === 0) continue;
		parentNode.children = children;
		const lastKey = children.at(-1);
		if (!lastKey) continue;
		const lastChild = tree[lastKey];
		if (
			lastChild?.meta &&
			(!childrenMap[lastKey] || childrenMap[lastKey].length === 0)
		) {
			lastChild.meta.lastNode = true;
		}
	}

	// Find root element and build resource node
	const rootElement = data.find((e) => e.type === "root");
	if (!rootElement?.name) return tree;

	const resourceType = rootElement.name;

	// Direct children of the resource type
	const directChildren: string[] = [];
	for (const path of Object.keys(tree)) {
		const parts = path.split(".");
		if (parts.length !== 2 || parts[0] !== resourceType) continue;
		const elName = parts[1];
		if (!elName) continue;
		const isUnionChild = data.some((el) => {
			if (!el["union?"] || !el.path) return false;
			const unionName = el.path.split(".").pop();
			return (
				unionName &&
				elName.startsWith(unionName) &&
				elName !== unionName &&
				el.path === `${resourceType}.${unionName}`
			);
		});
		if (!isUnionChild) directChildren.push(path);
	}

	// Ensure resource node exists
	if (tree[resourceType]) {
		if (
			!tree[resourceType].children ||
			tree[resourceType].children?.length === 0
		) {
			tree[resourceType].children = directChildren;
		}
	} else {
		tree[resourceType] = {
			name: resourceType,
			meta: {
				type: "Resource",
				min: "0",
				max: "*",
			},
			children: directChildren,
		};
	}

	tree.root = { name: "Root", children: [resourceType] };
	return tree;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useResourceJson(resourceType: string, resourceId: string) {
	const client = useAidboxClient();
	return useQuery<Record<string, unknown>>({
		queryKey: ["canonical-resource", resourceType, resourceId],
		staleTime: 5 * 60 * 1000,
		retry: false,
		queryFn: async () => {
			const result = await client.read<Record<string, unknown>>({
				type: resourceType,
				id: resourceId,
			});
			if (result.isErr()) {
				throw new Error(`Failed to load ${resourceType}/${resourceId}`);
			}
			return result.value.resource;
		},
	});
}

function useProfileElements(
	method: string,
	packageId: string,
	url: string,
	version: string,
) {
	const client = useAidboxClient();
	return useQuery<SnapshotElement[]>({
		queryKey: ["profile-elements", method, packageId, url],
		staleTime: 5 * 60 * 1000,
		enabled: !!url,
		retry: false,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method,
					params: {
						"package-coordinate": packageId,
						url,
						version,
					},
				}),
			});
			const json = await response.response.json();
			return json.result?.elements ?? json.data?.elements ?? [];
		},
	});
}

function useExpandValueSet(resourceId: string, enabled: boolean) {
	const client = useAidboxClient();
	return useQuery<ExpansionConcept[]>({
		queryKey: ["expand-valueset", resourceId],
		staleTime: 5 * 60 * 1000,
		enabled: enabled && !!resourceId,
		retry: false,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: `/fhir/ValueSet/${resourceId}/$expand`,
			});
			const json = await response.response.json();
			return json.expansion?.contains ?? [];
		},
	});
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function JsonTab({ data }: { data: Record<string, unknown> }) {
	return (
		<div className="relative h-full">
			<HSComp.CodeEditor
				readOnly
				currentValue={JSON.stringify(data, null, 2)}
				mode="json"
			/>
		</div>
	);
}

function StructureTab({
	method,
	packageId,
	url,
	version,
}: {
	method: string;
	packageId: string;
	url: string;
	version: string;
}) {
	const {
		data: elements,
		isLoading,
		error,
	} = useProfileElements(method, packageId, url, version);

	if (error) {
		return (
			<div className="p-6 text-text-negative text-sm">
				{(error as Error).message}
			</div>
		);
	}

	if (!url || isLoading || !elements) {
		return (
			<div className="p-4 flex flex-col gap-2">
				{Array.from({ length: 8 }, (_, i) => (
					<HSComp.Skeleton
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
						key={`skeleton-${i}`}
						className="h-6"
						style={{
							width: `${200 + ((i * 47) % 300)}px`,
							marginLeft: `${(i % 4) * 16}px`,
						}}
					/>
				))}
			</div>
		);
	}

	const tree = transformElementsToTree(elements);
	if (Object.keys(tree).length === 0) {
		return (
			<div className="p-6 text-text-secondary text-sm">No elements found</div>
		);
	}

	return (
		<div className="overflow-auto">
			<HSComp.FhirStructureView tree={tree} />
		</div>
	);
}

function ExpansionTab({ resourceId }: { resourceId: string }) {
	const { data, isLoading, error } = useExpandValueSet(resourceId, true);

	if (!resourceId || isLoading) {
		return (
			<div className="p-4 flex flex-col gap-2">
				{Array.from({ length: 10 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
					<HSComp.Skeleton key={`skeleton-${i}`} className="h-6 w-full" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-text-negative text-sm">
				{(error as Error).message}
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="p-6 text-text-secondary text-sm">
				No expansion results
			</div>
		);
	}

	return (
		<div className="overflow-auto h-full">
			<HSComp.Table zebra stickyHeader>
				<HSComp.TableHeader>
					<HSComp.TableRow>
						<HSComp.TableHead>System</HSComp.TableHead>
						<HSComp.TableHead>Code</HSComp.TableHead>
						<HSComp.TableHead>Display</HSComp.TableHead>
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{data.map((concept, index) => (
						<HSComp.TableRow
							key={`${concept.system}-${concept.code}-${index}`}
							zebra
							index={index}
						>
							<HSComp.TableCell className="text-text-secondary text-sm">
								{concept.system}
							</HSComp.TableCell>
							<HSComp.TableCell className="text-text-primary text-sm font-mono">
								{concept.code}
							</HSComp.TableCell>
							<HSComp.TableCell className="text-text-primary text-sm">
								{concept.display}
							</HSComp.TableCell>
						</HSComp.TableRow>
					))}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Tab configuration per resource type
// ---------------------------------------------------------------------------

type TabDef = {
	value: string;
	label: string;
};

function getTabsForType(resourceType: string): {
	tabs: TabDef[];
	defaultTab: string;
} {
	switch (resourceType) {
		case "FHIRSchema":
		case "StructureDefinition":
			return {
				tabs: [
					{ value: "json", label: "JSON" },
					{ value: "differential", label: "Differential" },
					{ value: "snapshot", label: "Snapshot" },
				],
				defaultTab: "json",
			};
		case "ValueSet":
			return {
				tabs: [
					{ value: "json", label: "JSON" },
					{ value: "expansion", label: "Expansion" },
				],
				defaultTab: "json",
			};
		default:
			return {
				tabs: [{ value: "json", label: "JSON" }],
				defaultTab: "json",
			};
	}
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CanonicalResource() {
	const { packageId, resourceType, resourceId } = useParams({
		from: "/ig/$packageId/resource/$resourceType/$resourceId",
	});
	const { view } = useSearch({
		from: "/ig/$packageId/resource/$resourceType/$resourceId",
	});
	const navigate = useNavigate();

	const { tabs, defaultTab } = getTabsForType(resourceType);
	const currentTab = tabs.find((t) => t.value === view)
		? (view as string)
		: defaultTab;

	const {
		data: jsonData,
		isLoading: jsonLoading,
		error: jsonError,
	} = useResourceJson(resourceType, resourceId);

	const setTab = (v: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				view: v === defaultTab ? undefined : v,
			}),
			replace: true,
		});
	};

	const sdUrl = (jsonData?.url as string) ?? "";
	const sdVersion = (jsonData?.version as string) ?? "";
	const resourceName = (jsonData?.name as string) ?? "";

	const header = resourceName ? (
		<div className="flex flex-col gap-0.5 pl-7 py-3 border-b border-border-secondary">
			<h1 className="text-text-primary text-base font-semibold">
				{resourceName}
			</h1>
			{sdUrl && <span className="text-text-assistive text-sm">{sdUrl}</span>}
		</div>
	) : null;

	// Single-tab case (CodeSystem, etc.) — no tab bar needed
	if (tabs.length === 1) {
		if (jsonLoading) {
			return (
				<div className="p-4">
					<HSComp.Skeleton className="h-full w-full" />
				</div>
			);
		}
		if (jsonError) {
			return (
				<div className="p-6 text-text-negative text-sm">
					{jsonError.message}
				</div>
			);
		}
		if (!jsonData) return null;
		return (
			<div className="flex flex-col grow min-h-0">
				{header}
				<JsonTab data={jsonData} />
			</div>
		);
	}

	return (
		<HSComp.Tabs
			value={currentTab}
			onValueChange={setTab}
			variant="tertiary"
			className="flex flex-col grow min-h-0"
		>
			{header}
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
				<HSComp.TabsList className="py-0! border-b-0!">
					{tabs.map((t) => (
						<HSComp.TabsTrigger key={t.value} value={t.value}>
							{t.label}
						</HSComp.TabsTrigger>
					))}
				</HSComp.TabsList>
			</div>

			{tabs.map((t) => {
				if (t.value === "json") {
					return (
						<HSComp.TabsContent
							key={t.value}
							value="json"
							className="relative grow min-h-0"
						>
							{jsonLoading ? (
								<div className="p-4">
									<HSComp.Skeleton className="h-full w-full" />
								</div>
							) : jsonError ? (
								<div className="p-6 text-text-negative text-sm">
									{jsonError.message}
								</div>
							) : jsonData ? (
								<HSComp.CodeEditor
									readOnly
									currentValue={JSON.stringify(jsonData, null, 2)}
									mode="json"
								/>
							) : null}
						</HSComp.TabsContent>
					);
				}

				if (t.value === "differential") {
					return (
						<HSComp.TabsContent
							key={t.value}
							value="differential"
							className="overflow-auto grow min-h-0"
						>
							<StructureTab
								method="aidbox.introspector/get-profile-differential"
								packageId={packageId}
								url={sdUrl}
								version={sdVersion}
							/>
						</HSComp.TabsContent>
					);
				}

				if (t.value === "snapshot") {
					return (
						<HSComp.TabsContent
							key={t.value}
							value="snapshot"
							className="overflow-auto grow min-h-0"
						>
							<StructureTab
								method="aidbox.introspector/get-profile-snapshot"
								packageId={packageId}
								url={sdUrl}
								version={sdVersion}
							/>
						</HSComp.TabsContent>
					);
				}

				if (t.value === "expansion") {
					return (
						<HSComp.TabsContent
							key={t.value}
							value="expansion"
							className="overflow-auto grow min-h-0"
						>
							<ExpansionTab resourceId={resourceId} />
						</HSComp.TabsContent>
					);
				}

				return null;
			})}
		</HSComp.Tabs>
	);
}
