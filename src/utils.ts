import type { TreeViewItem } from "@health-samurai/react-components";
import type { Header, Tab } from "./components/rest/active-tabs";
import type { Meta, Snapshot } from "./components/ViewDefinition/types";

export function getAidboxBaseURL(): string {
	const cookies = document.cookie.split("; ");
	for (const cookie of cookies) {
		const [name, rest] = cookie.split("=");
		if (name === "aidbox-base-url") {
			return decodeURIComponent(rest ?? "");
		}
	}

	const vite_base_url = import.meta.env.VITE_AIDBOX_BASE_URL;
	if (vite_base_url) {
		return vite_base_url;
	}
	return `${window.location.protocol}//${window.location.host}`;
}

export function parseHttpRequest(rawText: string): {
	method: string;
	path: string;
	headers: Header[];
	body: string;
} {
	const lines = rawText.split("\n");
	let method = "GET";
	let path = "";
	const headers: Header[] = [];
	const bodyLines: string[] = [];
	let isBodySection = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		if (i === 0 && line.trim()) {
			const requestLineParts = line.trim().split(/\s+/);
			if (requestLineParts.length >= 2) {
				method = requestLineParts[0] || "GET";
				path = requestLineParts.slice(1).join(" ");
			}
			continue;
		}

		if (line.trim() === "" && !isBodySection) {
			isBodySection = true;
			continue;
		}

		if (isBodySection) {
			bodyLines.push(line);
			continue;
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const headerName = line.substring(0, colonIndex).trim();
			const headerValue = line.substring(colonIndex + 1).trim();
			headers.push({
				id: crypto.randomUUID(),
				name: headerName,
				value: headerValue,
				enabled: true,
			});
		}
	}

	if (!headers.some((h) => h.name === "" && h.value === "")) {
		headers.push({
			id: crypto.randomUUID(),
			name: "",
			value: "",
			enabled: true,
		});
	}

	return {
		method,
		path,
		headers,
		body: bodyLines.join("\n").trim(),
	};
}

export function generateHttpRequest(tab: Tab): string {
	const requestLine = `${tab.method} ${tab.path || ""}`;

	const headers =
		tab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.map((header) => `${header.name}: ${header.value}`)
			.join("\n") || "";

	const body = tab.body || "";

	return `${requestLine}\n${headers}\n\n${body}`;
}

const getDisplayName = (
	element: Snapshot,
	path: string,
	isUnion: boolean,
): string => {
	const parts = path.split(".");
	const name = element.name || parts.at(-1) || "";
	return isUnion && !name.includes("[x]") ? `${name}[x]` : name;
};

const addChildToMap = (
	childrenMap: Record<string, string[]>,
	parentPath: string,
	childPath: string,
): void => {
	if (!childrenMap[parentPath]) {
		childrenMap[parentPath] = [];
	}
	if (!childrenMap[parentPath].includes(childPath)) {
		childrenMap[parentPath].push(childPath);
	}
};

const findUnionParent = (
	data: Snapshot[],
	path: string,
	lastPart: string,
): string | null => {
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

const buildParentChildRelationships = (
	data: Snapshot[],
	childrenMap: Record<string, string[]>,
): void => {
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
		if (parentNode === undefined) {
			continue;
		}

		if (children.length === 0) {
			continue;
		}

		const lastChildPath = children.at(-1);
		if (lastChildPath === undefined) {
			continue;
		}

		parentNode.children = children;
		const lastChildNode = tree[lastChildPath];

		if (
			lastChildNode?.meta &&
			(!childrenMap[lastChildPath] || childrenMap[lastChildPath]?.length === 0)
		) {
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

	const resourceElement = data.find(
		(e) =>
			e.path === resourceType || (e.type === "root" && e.name === resourceType),
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
};

const buildMeta = (element: Snapshot, isUnion: boolean): Meta => {
	const meta: Meta = {};

	if (element.min != null) meta.min = String(element.min);
	if (element.max != null)
		meta.max = element.max === "*" ? "*" : String(element.max);

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
	if (element["extension-coordinate"])
		meta.extensionCoordinate = element["extension-coordinate"];
	if (element.binding) meta.binding = element.binding;
	if (element["vs-coordinate"]) meta.vsCoordinate = element["vs-coordinate"];

	return meta;
};

export function transformSnapshotToTree(
	data: Snapshot[] | undefined,
): Record<string, TreeViewItem<Meta>> {
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
}
