import {
	Button,
	CodeEditor,
	CopyIcon,
	FHIRStructureView,
	Input,
	SegmentControl,
	SegmentControlItem,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AidboxCall, AidboxCallWithMeta } from "../../api/auth";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { SearchBar } from "./search-bar";
import type { ViewDefinition } from "./types";

const fetchSchema = async (resourceType: string): Promise<any> => {
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

		const data = JSON.parse(response.body);

		if (data?.result) {
			const defaultSchema = Object.values(data.result).find(
				(schema: any) => schema?.["default?"] === true,
			);

			if (defaultSchema) {
				const differential = (defaultSchema as any)?.snapshot;
				return differential || defaultSchema;
			} else {
				const schemas = Object.values(data.result);
				const firstSchema = schemas[0] as any;
				const differential = firstSchema?.differential;
				return differential || firstSchema || data;
			}
		} else {
			return data;
		}
	} catch (error) {
		throw new Error(
			error instanceof Error ? error.message : "Failed to fetch schema",
		);
	}
};

const searchResources = async (
	resourceType: string,
	searchParams: string,
): Promise<Record<string, unknown>[]> => {
	const url = searchParams.trim()
		? `/fhir/${resourceType}?${searchParams}`
		: `/fhir/${resourceType}`;

	const response = await AidboxCall<{
		entry?: Array<{ resource: Record<string, unknown> }>;
	}>({
		method: "GET",
		url: url,
		headers: {
			Accept: "application/json",
		},
	});

	if (response?.entry && response.entry.length > 0) {
		return response.entry.map((entry) => entry.resource);
	} else {
		return [];
	}
};

const transformSnapshotToTree = (data: any): Record<string, any> => {
	let elements: any[] = [];

	if (data?.snapshot && Array.isArray(data.snapshot)) {
		elements = data.snapshot;
	} else if (Array.isArray(data)) {
		elements = data;
	} else if (data?.element && Array.isArray(data.element)) {
		elements = data.element;
	} else if (data?.snapshot?.element && Array.isArray(data.snapshot.element)) {
		elements = data.snapshot.element;
	} else if (
		data?.differential?.element &&
		Array.isArray(data.differential.element)
	) {
		elements = data.differential.element;
	} else {
		const possibleArrays = Object.values(data || {}).filter((v) =>
			Array.isArray(v),
		);
		if (possibleArrays.length > 0) {
			elements = possibleArrays[0] as any[];
		}
	}

	if (!elements || elements.length === 0) {
		return {};
	}

	const tree: Record<string, any> = {};
	const childrenMap: Record<string, string[]> = {};

	// First pass: create all nodes and collect parent-child relationships
	elements.forEach((element: any) => {
		if (element.type === "root") return;

		const path = element.path || element.id;
		if (!path) return;

		const parts = path.split(".");
		const name = element.name || parts[parts.length - 1];

		const isUnion = element["union?"] === true;
		const displayName = isUnion && !name.includes("[x]") ? `${name}[x]` : name;

		const node: any = {
			name: displayName,
			meta: {},
		};

		if (element.min !== undefined && element.min !== null) {
			node.meta.min = String(element.min);
		}
		if (element.max !== undefined && element.max !== null) {
			node.meta.max = element.max === "*" ? "*" : String(element.max);
		}

		if (element.short) {
			node.meta.short = element.short;
		}
		if (element.desc) {
			node.meta.desc = element.desc;
		}
		node.meta.description = element.short || element.desc;

		if (isUnion) {
			node.meta.type = "union";
		} else if (element.datatype) {
			node.meta.type = element.datatype;
		} else if (element.type === "complex") {
			node.meta.type = element.datatype || "BackboneElement";
		} else if (element.type) {
			node.meta.type = element.type;
		}

		if (element.flags && Array.isArray(element.flags)) {
			element.flags.forEach((flag: string) => {
				if (flag === "summary") node.meta.isSummary = true;
				if (flag === "modifier") node.meta.isModifier = true;
				if (flag === "mustSupport") node.meta.mustSupport = true;
			});
		}

		if (element["extension-url"]) {
			node.meta.extensionUrl = element["extension-url"];
		}
		if (element["extension-coordinate"]) {
			node.meta.extensionCoordinate = element["extension-coordinate"];
		}

		if (element.binding) {
			node.meta.binding = element.binding;
		}
		if (element["vs-coordinate"]) {
			node.meta.vsCoordinate = element["vs-coordinate"];
		}

		tree[path] = node;

		if (parts.length > 1) {
			const lastPart = parts[parts.length - 1];
			let addedToUnionParent = false;

			elements.forEach((potentialParent: any) => {
				if (
					!addedToUnionParent &&
					potentialParent["union?"] === true &&
					potentialParent.path
				) {
					const unionParts = potentialParent.path.split(".");
					const unionName = unionParts[unionParts.length - 1];

					if (lastPart.startsWith(unionName) && lastPart !== unionName) {
						const possibleUnionPath =
							parts.slice(0, -1).join(".") + "." + unionName;

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
					(!childrenMap[lastChildPath] ||
						childrenMap[lastChildPath].length === 0)
				) {
					tree[lastChildPath].meta.lastNode = true;
				}
			}
		}
	});

	let resourceType = "";

	const rootElement = elements.find((e: any) => e.type === "root");
	if (rootElement && rootElement.name) {
		resourceType = rootElement.name;
	} else {
		elements.forEach((element: any) => {
			const path = element.path || element.id;
			if (path && !path.includes(".")) {
				resourceType = path;
			}
		});

		if (!resourceType && elements.length > 0) {
			const firstPath = elements.find((e: any) => e.path)?.path;
			if (firstPath) {
				resourceType = firstPath.split(".")[0];
			}
		}
	}

	if (resourceType) {
		const directChildren: string[] = [];
		Object.keys(tree).forEach((path) => {
			const parts = path.split(".");
			if (parts.length === 2 && parts[0] === resourceType) {
				const elementName = parts[1];
				let isUnionChild = false;

				elements.forEach((element: any) => {
					if (element["union?"] === true && element.path) {
						const unionName = element.path.split(".").pop();
						if (
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

		if (!tree[resourceType]) {
			const resourceElement = elements.find(
				(e: any) =>
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
		} else {
			if (
				!tree[resourceType].children ||
				tree[resourceType].children.length === 0
			) {
				tree[resourceType].children = directChildren;
			}
		}
	}

	tree.root = {
		name: "Root",
		children: resourceType ? [resourceType] : [],
	};

	return tree;
};

const ExampleTabEditorMenu = ({
	mode,
	onModeChange,
	copyText,
	onPrevious,
	onNext,
	canGoToPrevious,
	canGoToNext,
}: {
	mode: "json" | "yaml";
	onModeChange: (mode: "json" | "yaml") => void;
	copyText: string;
	onPrevious: () => void;
	onNext: () => void;
	canGoToPrevious: boolean;
	canGoToNext: boolean;
}) => {
	return (
		<div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
			<SegmentControl
				defaultValue={mode}
				name="example-editor-menu"
				onValueChange={(value) => onModeChange(value as "json" | "yaml")}
			>
				<SegmentControlItem value="json">JSON</SegmentControlItem>
				<SegmentControlItem value="yaml">YAML</SegmentControlItem>
			</SegmentControl>
			<Button variant="ghost" size="small" asChild>
				<CopyIcon text={copyText} />
			</Button>
			<div className="border-l h-6" />
			<Button
				variant="ghost"
				size="small"
				onClick={onPrevious}
				disabled={!canGoToPrevious}
			>
				<ChevronLeft />
			</Button>
			<Button
				variant="ghost"
				size="small"
				onClick={onNext}
				disabled={!canGoToNext}
			>
				<ChevronRight />
			</Button>
		</div>
	);
};

export function InfoPanel({
	viewDefinition,
	isLoadingViewDef,
}: {
	viewDefinition: ViewDefinition | undefined;
	isLoadingViewDef: boolean;
}) {
	const [activeTab, setActiveTab] = useLocalStorage<"schema" | "examples">({
		key: `viewDefinition-infoPanel-activeTab`,
		defaultValue: "schema",
	});
	const [exampleResource, setExampleResource] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [isLoadingExample, setIsLoadingExample] = useState(false);
	const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>(
		[],
	);
	const [currentResultIndex, setCurrentResultIndex] = useState(0);
	const [exampleMode, setExampleMode] = useLocalStorage<"json" | "yaml">({
		key: `viewDefinition-infoPanel-exampleMode`,
		defaultValue: "json",
	});
	const [schemaData, setSchemaData] = useState<any>(null);
	const [isLoadingSchema, setIsLoadingSchema] = useState(false);
	const [schemaError, setSchemaError] = useState<string | null>(null);

	const resourceType = viewDefinition?.resource || "Patient";

	// Fetch schema when activeTab changes to "schema" or resourceType changes
	useEffect(() => {
		if (activeTab === "schema" && resourceType && !isLoadingViewDef) {
			const loadSchema = async () => {
				setIsLoadingSchema(true);
				setSchemaError(null);
				try {
					const data = await fetchSchema(resourceType);
					setSchemaData(data);
				} catch (error) {
					setSchemaError(
						error instanceof Error ? error.message : "Failed to fetch schema",
					);
				} finally {
					setIsLoadingSchema(false);
				}
			};

			loadSchema();
		}
	}, [activeTab, resourceType, isLoadingViewDef]);

	// Auto-fetch examples when tab changes to "examples" and no data exists
	useEffect(() => {
		if (
			activeTab === "examples" &&
			viewDefinition?.resource &&
			!exampleResource &&
			!searchResults.length &&
			!isLoadingExample
		) {
			handleSearch("");
		}
	}, [activeTab, viewDefinition?.resource]);

	const handleSearch = async (query?: string) => {
		if (!viewDefinition?.resource) return;

		setIsLoadingExample(true);
		try {
			const searchParams = query !== undefined ? query : "";
			const resources = await searchResources(
				viewDefinition.resource,
				searchParams,
			);

			if (resources.length > 0) {
				setSearchResults(resources);
				setCurrentResultIndex(0);
				setExampleResource(resources[0] || null);
			} else {
				setSearchResults([]);
				setCurrentResultIndex(0);
				setExampleResource({ message: "No results found" });
			}
		} catch (error) {
			setSearchResults([]);
			setCurrentResultIndex(0);
			setExampleResource({
				error: "Failed to fetch resource",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsLoadingExample(false);
		}
	};

	const handlePrevious = () => {
		if (currentResultIndex > 0 && searchResults.length > 0) {
			const newIndex = currentResultIndex - 1;
			setCurrentResultIndex(newIndex);
			setExampleResource(searchResults[newIndex] || null);
		}
	};

	const handleNext = () => {
		if (currentResultIndex < searchResults.length - 1) {
			const newIndex = currentResultIndex + 1;
			setCurrentResultIndex(newIndex);
			setExampleResource(searchResults[newIndex] || null);
		}
	};

	const canGoToPrevious = currentResultIndex > 0;
	const canGoToNext = currentResultIndex < searchResults.length - 1;

	// Transform differential data to tree format for FHIRStructureView

	const fhirStructureTree = useMemo(() => {
		if (schemaData) {
			return transformSnapshotToTree(schemaData);
		}
		return {};
	}, [schemaData]);

	// Generate copy text based on current mode and content
	const getCopyText = () => {
		if (!exampleResource) {
			const defaultContent = {
				resourceType,
				hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
				examples: ["_id=<resource-id>", "name=<name>", "_count=10"],
			};
			return exampleMode === "yaml"
				? yaml.dump(defaultContent, { indent: 2 })
				: JSON.stringify(defaultContent, null, 2);
		}

		return exampleMode === "yaml"
			? yaml.dump(exampleResource, { indent: 2 })
			: JSON.stringify(exampleResource, null, 2);
	};

	return (
		<div className="flex flex-col h-full">
			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as "schema" | "examples")}
			>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
					<div className="flex items-center gap-8">
						<span className="typo-label text-text-secondary">Resource:</span>
						<TabsList>
							<TabsTrigger value="schema" className="px-0 mr-6">
								Schema
							</TabsTrigger>
							<TabsTrigger value="examples" className="px-0">
								Instance Examples
							</TabsTrigger>
						</TabsList>
					</div>
				</div>
				<TabsContent value="schema" className="h-full overflow-auto">
					{isLoadingViewDef || isLoadingSchema ? (
						<div className="flex items-center justify-center h-full text-text-secondary">
							<div className="text-center">
								<div className="text-lg mb-2">Loading schema...</div>
								<div className="text-sm">Fetching {resourceType} schema</div>
							</div>
						</div>
					) : schemaError ? (
						<div className="flex items-center justify-center h-full text-text-secondary">
							<div className="text-center">
								<div className="text-lg mb-2 text-red-600">
									Error loading schema
								</div>
								<div className="text-sm">{schemaError}</div>
							</div>
						</div>
					) : (
						<div className="px-4 h-full w-full overflow-auto">
							<FHIRStructureView tree={fhirStructureTree} />
						</div>
					)}
				</TabsContent>
				<TabsContent value="examples" className="flex flex-col h-full">
					<SearchBar
						handleSearch={handleSearch}
						isLoadingExample={isLoadingExample}
					/>
					<div className="flex-1 overflow-auto">
						{isLoadingViewDef ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Loading examples...</div>
									<div className="text-sm">
										Fetching {resourceType} examples
									</div>
								</div>
							</div>
						) : isLoadingExample ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Searching...</div>
									<div className="text-sm">
										Fetching {resourceType} instances
									</div>
								</div>
							</div>
						) : (
							<div className="relative h-full w-full">
								<div className="absolute top-2 right-3 z-10">
									<ExampleTabEditorMenu
										mode={exampleMode}
										onModeChange={setExampleMode}
										copyText={getCopyText()}
										onPrevious={handlePrevious}
										onNext={handleNext}
										canGoToPrevious={canGoToPrevious}
										canGoToNext={canGoToNext}
									/>
								</div>
								<CodeEditor
									readOnly
									currentValue={
										exampleResource
											? exampleMode === "yaml"
												? yaml.dump(exampleResource, { indent: 2 })
												: JSON.stringify(exampleResource, null, 2)
											: exampleMode === "yaml"
												? yaml.dump(
														{
															resourceType,
															hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
															examples: [
																"_id=<resource-id>",
																"name=<name>",
																"_count=10",
															],
														},
														{ indent: 2 },
													)
												: JSON.stringify(
														{
															resourceType,
															hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
															examples: [
																"_id=<resource-id>",
																"name=<name>",
																"_count=10",
															],
														},
														null,
														2,
													)
									}
									mode={exampleMode}
								/>
							</div>
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
