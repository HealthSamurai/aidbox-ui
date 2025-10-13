import type { TreeViewItem } from "@health-samurai/react-components";
import { FhirStructureView, TabsContent } from "@health-samurai/react-components";
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

const fetchSchema = async (resourceType: string): Promise<Array<Snapshot> | undefined> => {
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

	if (!data?.result) return undefined;

	const defaultSchema = Object.values(data.result).find((schema: Schema) => schema["default?"] === true);

	return defaultSchema?.snapshot;
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

const buildMeta = (element: Snapshot, isUnion: boolean): Meta => {
	const meta: Meta = {};

	if (element.min != null) meta.min = String(element.min);
	if (element.max != null) meta.max = element.max === "*" ? "*" : String(element.max);

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
		meta.isSummary = element.flags.includes("summary");
		meta.isModifier = element.flags.includes("modifier");
		meta.mustSupport = element.flags.includes("mustSupport");
	}

	if (element["extension-url"]) meta.extensionUrl = element["extension-url"];
	if (element["extension-coordinate"]) meta.extensionCoordinate = element["extension-coordinate"];
	if (element.binding) meta.binding = element.binding;
	if (element["vs-coordinate"]) meta.vsCoordinate = element["vs-coordinate"];

	return meta;
};

const getDisplayName = (element: Snapshot, path: string, isUnion: boolean): string => {
	const parts = path.split(".");
	const name = element.name || parts.at(-1) || "";
	return isUnion && !name.includes("[x]") ? `${name}[x]` : name;
};

const addChildToMap = (childrenMap: Record<string, string[]>, parentPath: string, childPath: string): void => {
	if (!childrenMap[parentPath]) {
		childrenMap[parentPath] = [];
	}
	if (!childrenMap[parentPath].includes(childPath)) {
		childrenMap[parentPath].push(childPath);
	}
};

const findUnionParent = (data: Snapshot[], path: string, lastPart: string): string | null => {
	const parts = path.split(".");

	for (const potentialParent of data) {
		if (!potentialParent["union?"] || !potentialParent.path) continue;

		const unionName = potentialParent.path.split(".").at(-1);
		if (!unionName) throw Error("Union has no name");

		if (lastPart.startsWith(unionName) && lastPart !== unionName) {
			const possibleUnionPath = `${parts.slice(0, -1).join(".")}.${unionName}`;
			if (potentialParent.path === possibleUnionPath) {
				return potentialParent.path;
			}
		}
	}

	return null;
};

const buildParentChildRelationships = (data: Snapshot[], childrenMap: Record<string, string[]>): void => {
	for (const element of data) {
		if (element.type === "root" || !element.path) continue;

		const path = element.path;
		const parts = path.split(".");
		const lastPart = parts.at(-1);

		if (!lastPart) continue;

		const unionParentPath = findUnionParent(data, path, lastPart);

		if (unionParentPath) {
			addChildToMap(childrenMap, unionParentPath, path);
		} else {
			const parentPath = parts.slice(0, -1).join(".");
			addChildToMap(childrenMap, parentPath, path);
		}
	}
};

const attachChildrenAndMarkLastNodes = (
	tree: Record<string, TreeViewItem<Meta>>,
	childrenMap: Record<string, string[]>,
): void => {
	for (const [parentPath, children] of Object.entries(childrenMap)) {
		const parentNode = tree[parentPath];
		if (!parentNode || children.length === 0) continue;

		parentNode.children = children;

		const lastChildPath = children[children.length - 1];
		const lastChildNode = tree[lastChildPath];

		if (lastChildNode?.meta && (!childrenMap[lastChildPath] || childrenMap[lastChildPath].length === 0)) {
			lastChildNode.meta.lastNode = true;
		}
	}
};

const findDirectChildren = (
	tree: Record<string, TreeViewItem<Meta>>,
	data: Snapshot[],
	resourceType: string,
): string[] => {
	const directChildren: string[] = [];

	for (const path of Object.keys(tree)) {
		const parts = path.split(".");
		if (parts.length !== 2 || parts[0] !== resourceType) continue;

		const elementName = parts[1];
		if (!elementName) continue;

		const isUnionChild = data.some((element) => {
			if (!element["union?"] || !element.path) return false;

			const unionName = element.path.split(".").pop();
			return (
				unionName &&
				elementName.startsWith(unionName) &&
				elementName !== unionName &&
				element.path === `${resourceType}.${unionName}`
			);
		});

		if (!isUnionChild) {
			directChildren.push(path);
		}
	}

	return directChildren;
};

const ensureResourceNode = (
	tree: Record<string, TreeViewItem<Meta>>,
	data: Snapshot[],
	resourceType: string,
	directChildren: string[],
): void => {
	const existingNode = tree[resourceType];

	if (existingNode) {
		if (!existingNode.children || existingNode.children.length === 0) {
			existingNode.children = directChildren;
		}
		return;
	}

	const resourceElement = data.find((e) => e.path === resourceType || (e.type === "root" && e.name === resourceType));

	tree[resourceType] = {
		name: resourceType,
		meta: {
			type: "Resource",
			min: "0",
			max: "*",
			description: resourceElement?.short || resourceElement?.desc || `Information about ${resourceType}`,
		},
		children: directChildren,
	};
};

const transformSnapshotToTree = (data: Snapshot[] | undefined): Record<string, TreeViewItem<Meta>> => {
	if (!data || data.length === 0) return {};

	const tree: Record<string, TreeViewItem<Meta>> = {};
	const childrenMap: Record<string, string[]> = {};

	// First pass: create all nodes
	for (const element of data) {
		if (element.type === "root" || !element.path) continue;

		const path = element.path;
		const isUnion = element["union?"] === true;

		tree[path] = {
			name: getDisplayName(element, path, isUnion),
			meta: buildMeta(element, isUnion),
		};
	}

	buildParentChildRelationships(data, childrenMap);
	attachChildrenAndMarkLastNodes(tree, childrenMap);

	const rootElement = data.find((e) => e.type === "root");
	if (!rootElement?.name) {
		throw Error("no Root element");
	}

	const resourceType = rootElement.name;
	const directChildren = findDirectChildren(tree, data, resourceType);

	ensureResourceNode(tree, data, resourceType, directChildren);

	tree.root = {
		name: "Root",
		children: [resourceType],
	};

	return tree;
};

export function SchemaTabContent() {
	const viewDefinitionTypeContext = useContext(ViewDefinitionResourceTypeContext);
	const viewDefinitionResourceType = viewDefinitionTypeContext.viewDefinitionResourceType;

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID],
		queryFn: () => {
			if (!viewDefinitionResourceType) return;
			return fetchSchema(viewDefinitionResourceType);
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<TabsContent value="schema" className="h-full overflow-auto">
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">Loading schema...</div>
						<div className="text-sm">Fetching {viewDefinitionResourceType} schema</div>
					</div>
				</div>
			</TabsContent>
		);
	}

	if (status === "error") {
		return (
			<TabsContent value="schema" className="h-full overflow-auto">
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2 text-red-600">Error loading schema</div>
						<div className="text-sm">{error.message}</div>
					</div>
				</div>
			</TabsContent>
		);
	}

	return (
		<TabsContent value="schema" className="h-full overflow-auto">
			<div className="h-full w-full overflow-auto px-2">
				<FhirStructureView tree={transformSnapshotToTree(data)} />
			</div>
		</TabsContent>
	);
}
