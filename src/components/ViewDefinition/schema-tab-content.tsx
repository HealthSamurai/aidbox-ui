import type { TreeViewItem } from "@health-samurai/react-components";
import {
	FHIRStructureView,
	TabsContent,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { AidboxCallWithMeta } from "../../api/auth";
import * as Constants from "./constants";
import { ViewDefinitionResourceTypeContext } from "./page";

interface Snapshot {
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
		"package-spec": {
			name: string;
			version: string;
		};
	};
}

interface Schema {
	differential: Array<Snapshot>;
	snapshot: Array<Snapshot>;
	"default?": boolean;
}

interface SchemaData {
	result: Record<string, Schema>;
}

const fetchSchema = async (
	resourceType: string,
): Promise<Array<Snapshot> | undefined> => {
	try {
		const response = await AidboxCallWithMeta({
			method: "POST",
			url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				method: "aidbox.introspector/get-schemas-by-resource-type",
				params: { "resource-type": resourceType },
			}),
		});

		const data: SchemaData = JSON.parse(response.body);

		if (data?.result) {
			const defaultSchema = Object.values(data.result).find(
				(schema: Schema) => schema?.["default?"] === true,
			);
			const snapshot = defaultSchema?.snapshot;
			return snapshot;
		} else {
			return undefined;
		}
	} catch (error) {
		throw new Error(
			error instanceof Error ? error.message : "Failed to fetch schema",
		);
	}
};

interface Meta {
	type?: string;
	description?: string | undefined;
	min?: number | string;
	max?: number | string;
	short?: string;
	isSummary?: boolean;
	isModifier?: boolean;
	mustSupport?: boolean;
	desc?: string;
	extensionUrl?: string;
	extensionCoordinate?: { label: string };
	binding?: { strength: string; valueSet: string };
	vsCoordinate?: {
		label: string;
		id: string;
		"package-spec": { name: string; version: string };
	};
	lastNode?: boolean;
}

const transformSnapshotToTree = (
	data: Array<Snapshot> | undefined,
): Record<string, TreeViewItem<Meta>> => {
	if (!data || data.length === 0) return {};

	const tree: Record<string, TreeViewItem<Meta>> = {};
	const childrenMap: Record<string, string[]> = {};

	// First pass: create all nodes and collect parent-child relationships
	data.forEach((element: Snapshot) => {
		if (element.type === "root") return;

		const path = element.path;
		if (!path) return;

		const isUnion = element["union?"] === true;

		const meta: Meta = {};

		if (element.min !== undefined && element.min !== null) {
			meta.min = String(element.min);
		}
		if (element.max !== undefined && element.max !== null) {
			meta.max = element.max === "*" ? "*" : String(element.max);
		}

		if (element.short) meta.short = element.short;

		if (element.desc) meta.desc = element.desc;

		meta.description = element.short || element.desc;

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
			element.flags.forEach((flag: string) => {
				if (flag === "summary") meta.isSummary = true;
				if (flag === "modifier") meta.isModifier = true;
				if (flag === "mustSupport") meta.mustSupport = true;
			});
		}

		if (element["extension-url"]) meta.extensionUrl = element["extension-url"];

		if (element["extension-coordinate"])
			meta.extensionCoordinate = element["extension-coordinate"];

		if (element.binding) meta.binding = element.binding;

		if (element["vs-coordinate"]) meta.vsCoordinate = element["vs-coordinate"];

		const parts = path.split(".");
		const name = element.name || parts.at(-1) || "";
		const displayName = isUnion && !name.includes("[x]") ? `${name}[x]` : name;

		tree[path] = {
			name: displayName,
			meta: meta,
		};

		const lastPart = parts.at(-1);

		if (lastPart) {
			let addedToUnionParent = false;

			data.forEach((potentialParent: Snapshot) => {
				if (
					!addedToUnionParent &&
					potentialParent["union?"] === true &&
					potentialParent.path
				) {
					const unionName = potentialParent.path.split(".").at(-1);
					if (!unionName) throw Error("Union has no name");

					if (lastPart.startsWith(unionName) && lastPart !== unionName) {
						const possibleUnionPath = `${parts.slice(0, -1).join(".")}.${unionName}`;

						if (potentialParent.path === possibleUnionPath) {
							if (!childrenMap[potentialParent.path]) {
								childrenMap[potentialParent.path] = [];
							}
							if (!childrenMap[potentialParent.path]?.includes(path)) {
								childrenMap[potentialParent.path]?.push(path);
							}
							addedToUnionParent = true;
						}
					}
				}
			});

			if (!addedToUnionParent) {
				const parentPath = parts.slice(0, -1).join(".");
				if (!childrenMap[parentPath]) {
					childrenMap[parentPath] = [];
				}
				if (!childrenMap[parentPath].includes(path)) {
					childrenMap[parentPath].push(path);
				}
			}
		}
	});

	// Second pass: add children arrays and mark last nodes
	Object.entries(childrenMap).forEach(([parentPath, children]) => {
		if (tree[parentPath]) {
			tree[parentPath].children = children;

			if (children.length > 0) {
				const lastChildPath = children[children.length - 1];
				if (
					lastChildPath &&
					tree[lastChildPath] &&
					tree[lastChildPath].meta &&
					(!childrenMap[lastChildPath] ||
						childrenMap[lastChildPath].length === 0)
				) {
					tree[lastChildPath].meta.lastNode = true;
				}
			}
		}
	});

	let resourceType = "";

	const rootElement = data.find((e: Snapshot) => e.type === "root");

	if (rootElement?.name) {
		resourceType = rootElement.name;
	} else {
		throw Error("no Root element");
	}

	const directChildren: string[] = [];

	Object.keys(tree).forEach((path) => {
		const parts = path.split(".");
		if (parts.length === 2 && parts[0] === resourceType) {
			const elementName = parts[1];
			let isUnionChild = false;

			data.forEach((element: Snapshot) => {
				if (element["union?"] === true && element.path) {
					const unionName = element.path.split(".").pop();
					if (
						unionName &&
						elementName?.startsWith(unionName) &&
						elementName !== unionName &&
						element.path === `${resourceType}.${unionName}`
					) {
						isUnionChild = true;
					}
				}
			});

			if (!isUnionChild && !directChildren.includes(path)) {
				directChildren.push(path);
			}
		}
	});

	const node = tree[resourceType];

	if (node && (!node?.children || node?.children?.length === 0)) {
		node.children = directChildren;
	} else if (!node) {
		const resourceElement = data.find(
			(e: Snapshot) =>
				e.path === resourceType ||
				(e.type === "root" && e.name === resourceType),
		);

		tree[resourceType] = {
			name: resourceType,
			meta: {
				type: "Resource",
				min: "0",
				max: "*",
				description:
					resourceElement?.short ||
					resourceElement?.desc ||
					`Information about ${resourceType}`,
			},
			children: directChildren,
		};
	}

	tree.root = {
		name: "Root",
		children: resourceType ? [resourceType] : [],
	};

	return tree;
};

export function SchemaTabContent() {
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);
	const viewDefinitionResourceType =
		viewDefinitionTypeContext.viewDefinitionResourceType;

	const resourceType = viewDefinitionResourceType || "Patient";

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID],
		queryFn: async () => {
			if (!viewDefinitionResourceType) return;
			return await fetchSchema(resourceType);
		},
		retry: false,
	});

	return (
		<TabsContent value="schema" className="h-full overflow-auto">
			{isLoading ? (
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">Loading schema...</div>
						<div className="text-sm">Fetching {resourceType} schema</div>
					</div>
				</div>
			) : status === "error" ? (
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2 text-red-600">
							Error loading schema
						</div>
						<div className="text-sm">{error.message}</div>
					</div>
				</div>
			) : (
				<div className="px-4 h-full w-full overflow-auto">
					<FHIRStructureView tree={transformSnapshotToTree(data)} />
				</div>
			)}
		</TabsContent>
	);
}
