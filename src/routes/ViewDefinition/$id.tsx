import {
	Button,
	CodeEditor,
	type ColumnDef,
	Combobox,
	type ComboboxOption,
	CopyIcon,
	DataTable,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	FHIRStructureView,
	Input,
	type ItemInstance,
	PlayIcon,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	SegmentControl,
	SegmentControlItem,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	TreeView,
	type TreeViewItem,
	toast,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Funnel,
	Pi,
	PlusIcon,
	Save,
	TextQuote,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { AidboxCall, AidboxCallWithMeta } from "../../api/auth";
import ViewDefinitionPage from "../../components/ViewDefinition/page";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface SelectItem {
	column?: Array<{
		name?: string;
		path?: string;
		type?: string;
	}>;
	forEach?: string;
	forEachOrNull?: string;
	unionAll?: SelectItem[];
	select?: SelectItem[];
}

interface ViewDefinition {
	resourceType: string;
	id?: string;
	name?: string;
	status?: string;
	resource?: string;
	description?: string;
	select?: SelectItem[];
	[key: string]: any;
}

// Helper functions for ViewDefinitionForm
const fetchResourceTypes = async (): Promise<ComboboxOption[]> => {
	try {
		const response = await AidboxCall<Record<string, any>>({
			method: "GET",
			url: "/$resource-types",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		if (response) {
			const options: ComboboxOption[] = Object.keys(response)
				.sort()
				.map((resourceType) => ({
					value: resourceType,
					label: resourceType,
				}));
			return options;
		}
	} catch (error) {
		const defaultTypes = [
			"Patient",
			"Practitioner",
			"Organization",
			"Observation",
			"Condition",
			"Procedure",
			"Encounter",
			"Medication",
			"MedicationRequest",
			"AllergyIntolerance",
		];
		return defaultTypes.map((type) => ({ value: type, label: type }));
	}
	return [];
};

const parseSelectItems = (items: any[], parentId = ""): any[] => {
	return items
		.map((item, index) => {
			const id = `${parentId}select-${index}-${crypto.randomUUID()}`;

			if (item.column) {
				return {
					id,
					type: "column" as const,
					columns: item.column.map((c: any, idx: number) => ({
						id: `${id}-col-${idx}-${crypto.randomUUID()}`,
						name: c.name || "",
						path: c.path || "",
					})),
				};
			} else if (item.forEach !== undefined) {
				return {
					id,
					type: "forEach" as const,
					expression: item.forEach,
					children: item.select ? parseSelectItems(item.select, `${id}-`) : [],
				};
			} else if (item.forEachOrNull !== undefined) {
				return {
					id,
					type: "forEachOrNull" as const,
					expression: item.forEachOrNull,
					children: item.select ? parseSelectItems(item.select, `${id}-`) : [],
				};
			} else if (item.unionAll) {
				return {
					id,
					type: "unionAll" as const,
					children: parseSelectItems(item.unionAll, `${id}-`),
				};
			}
			return null;
		})
		.filter(Boolean);
};

const buildSelectArray = (items: any[]): any[] => {
	return items
		.map((item) => {
			if (item.type === "column" && item.columns) {
				return {
					column: item.columns.map((col: any) => ({
						name: col.name,
						path: col.path,
					})),
				};
			} else if (item.type === "forEach") {
				const result: any = { forEach: item.expression || "" };
				if (item.children && item.children.length > 0) {
					result.select = buildSelectArray(item.children);
				}
				return result;
			} else if (item.type === "forEachOrNull") {
				const result: any = { forEachOrNull: item.expression || "" };
				if (item.children && item.children.length > 0) {
					result.select = buildSelectArray(item.children);
				}
				return result;
			} else if (item.type === "unionAll") {
				return {
					unionAll: item.children ? buildSelectArray(item.children) : [],
				};
			}
			return null;
		})
		.filter(Boolean);
};

const findPath = (
	items: any[],
	targetId: string,
	path: string[] = [],
): string[] | null => {
	for (const item of items) {
		if (item.id === targetId) {
			return path;
		}
		if (item.children) {
			const result = findPath(item.children, targetId, [...path, item.id]);
			if (result) return result;
		}
	}
	return null;
};

// Helper functions for LeftPanel
const formatCode = (content: string, mode: "json" | "yaml"): string => {
	try {
		if (mode === "yaml") {
			const parsed = yaml.load(content);
			return yaml.dump(parsed, { indent: 2 });
		} else {
			const parsed = JSON.parse(content);
			return JSON.stringify(parsed, null, 2);
		}
	} catch (error) {
		return content;
	}
};

const fetchSQL = async (viewDefinition: ViewDefinition): Promise<string> => {
	try {
		const parametersPayload = {
			resourceType: "Parameters",
			parameter: [
				{
					name: "viewResource",
					resource: viewDefinition,
				},
			],
		};

		const response = await AidboxCallWithMeta({
			method: "POST",
			url: "/fhir/ViewDefinition/$sql",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/fhir+json",
			},
			body: JSON.stringify(parametersPayload),
		});

		try {
			const json = JSON.parse(response.body);
			if (json.issue) {
				return `-- Error: ${json.issue[0]?.diagnostics || "Unknown error"}`;
			} else if (json.parameter && json.parameter[0]?.valueString) {
				try {
					return formatSQL(json.parameter[0].valueString, {
						language: "postgresql",
						keywordCase: "upper",
						linesBetweenQueries: 2,
					});
				} catch {
					return json.parameter[0].valueString;
				}
			} else {
				return response.body;
			}
		} catch {
			return response.body;
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return `-- Error fetching SQL: ${errorMessage}`;
	}
};

const parseViewDefinition = (content: string, mode: "json" | "yaml"): any => {
	if (mode === "yaml") {
		return yaml.load(content);
	} else {
		return JSON.parse(content);
	}
};

const runViewDefinition = async (viewDefinitionToRun: any): Promise<any> => {
	const parametersPayload = {
		resourceType: "Parameters",
		parameter: [
			{
				name: "viewResource",
				resource: viewDefinitionToRun,
			},
			{
				name: "_format",
				valueCode: "json",
			},
		],
	};

	const response = await AidboxCallWithMeta({
		method: "POST",
		url: "/fhir/ViewDefinition/$run",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/fhir+json",
		},
		body: JSON.stringify(parametersPayload),
	});

	return response;
};

const processRunResponse = (
	response: any,
): { success: boolean; data: any; diagnostics?: string[] } => {
	try {
		const json = JSON.parse(response.body);

		if (json.resourceType === "OperationOutcome" && json.issue) {
			const diagnostics = json.issue
				.filter((issue: any) => issue.diagnostics)
				.map((issue: any) => issue.diagnostics);

			return {
				success: false,
				data: json,
				diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
			};
		} else if (json.data && typeof json.data === "string") {
			try {
				const decoded = atob(json.data);
				return { success: true, data: JSON.parse(decoded) };
			} catch {
				return { success: true, data: json.data };
			}
		} else if (json.data) {
			return { success: true, data: json.data };
		} else {
			return { success: true, data: json };
		}
	} catch {
		return { success: true, data: response.body };
	}
};

const saveViewDefinition = async (
	viewDefinitionToSave: any,
	routeId: string,
): Promise<any> => {
	const response = await AidboxCallWithMeta({
		method: "PUT",
		url: `/fhir/ViewDefinition/${routeId}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(viewDefinitionToSave),
	});

	return response;
};

const checkSaveSuccess = (response: any): boolean => {
	const status = response.meta?.status || response.status;
	return (
		(status && status >= 200 && status < 300) ||
		response.meta?.ok === true ||
		(!response.meta?.status && response.body)
	);
};

// Helper functions for BottomPanel


export const Route = createFileRoute("/ViewDefinition/$id")({
	component: PageComponent,
	staticData: {
		title: "View Definitions",
	},
});

const CodeEditorMenu = ({
	mode,
	onModeChange,
	textToCopy,
	onFormat,
}: {
	mode: "json" | "yaml";
	onModeChange: (mode: "json" | "yaml") => void;
	textToCopy: string;
	onFormat: () => void;
}) => {
	return (
		<div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
			<SegmentControl
				defaultValue={mode}
				name="code-editor-menu"
				onValueChange={(value) => onModeChange(value as "json" | "yaml")}
			>
				<SegmentControlItem value="json">JSON</SegmentControlItem>
				<SegmentControlItem value="yaml">YAML</SegmentControlItem>
			</SegmentControl>
			<Button
				variant="ghost"
				size="small"
				onClick={onFormat}
				title="Format code"
			>
				<TextQuote className="w-4 h-4" />
			</Button>
			<Button variant="ghost" size="small" asChild>
				<CopyIcon text={textToCopy} />
			</Button>
		</div>
	);
};

const ViewDefinitionForm = ({
	viewDefinition,
	onUpdate,
}: {
	viewDefinition: ViewDefinition;
	onUpdate?: (updatedViewDef: ViewDefinition) => void;
}) => {
	// State for managing constants dynamically
	const [constants, setConstants] = useState<
		Array<{
			id: string;
			name: string;
			valueString: string;
		}>
	>([]);

	// State for managing where conditions dynamically
	const [whereConditions, setWhereConditions] = useState<
		Array<{
			id: string;
			name: string;
			value: string;
		}>
	>([]);

	// State for managing select items dynamically (nested structure)
	const [selectItems, setSelectItems] = useState<
		Array<{
			id: string;
			type: "column" | "forEach" | "forEachOrNull" | "unionAll";
			// For column type
			columns?: Array<{
				id: string;
				name: string;
				path: string;
			}>;
			// For forEach/forEachOrNull types
			expression?: string;
			// For nested selects
			children?: any[];
		}>
	>([]);

	// State for collapsed items using localStorage - tree renders fully expanded by default
	const [collapsedItemIds, setCollapsedItemIds] = useLocalStorage<string[]>({
		key: `viewDefinition-form-collapsed-${viewDefinition?.id || "default"}`,
		defaultValue: [], // Start with nothing collapsed - tree is fully expanded
	});

	// Track the previous tree structure to detect changes
	const previousTreeKeysRef = useRef<string>("");

	// Initialize state from viewDefinition - only on initial load or when ID changes
	const [lastViewDefId, setLastViewDefId] = useState<string | null>(null);

	useEffect(() => {
		// Initialize when viewDefinition first becomes available or when switching to a different one
		if (viewDefinition && viewDefinition.id !== lastViewDefId) {
			setLastViewDefId(viewDefinition.id || null);
			if (
				viewDefinition?.constant &&
				Array.isArray(viewDefinition.constant) &&
				viewDefinition.constant.length > 0
			) {
				const constantsWithIds = viewDefinition.constant.map(
					(c: any, index: number) => ({
						id: `constant-${index}-${crypto.randomUUID()}`,
						name: c.name || "",
						valueString: c.valueString || "",
					}),
				);
				setConstants(constantsWithIds);
			} else {
				setConstants([]);
			}

			// Initialize where conditions from viewDefinition
			if (
				viewDefinition?.where &&
				Array.isArray(viewDefinition.where) &&
				viewDefinition.where.length > 0
			) {
				const whereWithIds = viewDefinition.where.map(
					(w: any, index: number) => ({
						id: `where-${index}-${crypto.randomUUID()}`,
						name: w.name || "",
						value: w.value || "",
					}),
				);
				setWhereConditions(whereWithIds);
			} else {
				setWhereConditions([]);
			}

			// Initialize select items from viewDefinition
			if (viewDefinition?.select && Array.isArray(viewDefinition.select)) {
				setSelectItems(parseSelectItems(viewDefinition.select));
			} else {
				setSelectItems([]);
			}
		}
	}, [viewDefinition, lastViewDefId]);

	// Function to update ViewDefinition with new constants and where conditions
	const updateViewDefinition = useCallback(
		(
			updatedConstants?: Array<{
				id: string;
				name: string;
				valueString: string;
			}>,
			updatedWhere?: Array<{ id: string; name: string; value: string }>,
			updatedFields?: { name?: string },
			updatedSelectItems?: any[],
		) => {
			if (onUpdate) {
				const constantArray = (updatedConstants || constants).map((c) => ({
					name: c.name,
					valueString: c.valueString,
				}));

				const whereArray = (updatedWhere || whereConditions).map((w) => ({
					name: w.name,
					value: w.value,
				}));

				// Convert selectItems to proper JSON structure

				const selectArray = buildSelectArray(updatedSelectItems || selectItems);

				const updatedViewDef: any = {
					...viewDefinition,
					...(updatedFields || {}),
				};

				// Only add arrays if they have content
				if (constantArray.length > 0) {
					updatedViewDef.constant = constantArray;
				} else {
					delete updatedViewDef.constant;
				}

				if (whereArray.length > 0) {
					updatedViewDef.where = whereArray;
				} else {
					delete updatedViewDef.where;
				}

				if (selectArray.length > 0) {
					updatedViewDef.select = selectArray;
				} else {
					delete updatedViewDef.select;
				}

				onUpdate(updatedViewDef);
			}
		},
		[viewDefinition, constants, whereConditions, selectItems, onUpdate],
	);

	// Function to add a new constant
	const addConstant = () => {
		const newConstant = {
			id: `constant-${constants.length}-${crypto.randomUUID()}`,
			name: "",
			valueString: "",
		};
		const updatedConstants = [...constants, newConstant];
		setConstants(updatedConstants);

		// Remove the new constant and its parent from collapsed items to ensure they're visible
		const newCollapsedIds = collapsedItemIds.filter(
			(id) => id !== newConstant.id && id !== "_constant",
		);
		setCollapsedItemIds(newCollapsedIds);

		updateViewDefinition(updatedConstants);
	};

	// Function to update a specific constant
	const updateConstant = (
		id: string,
		field: "name" | "valueString",
		value: string,
	) => {
		const updatedConstants = constants.map((c) =>
			c.id === id ? { ...c, [field]: value } : c,
		);
		setConstants(updatedConstants);
		updateViewDefinition(updatedConstants);
	};

	// Function to remove a constant
	const removeConstant = (id: string) => {
		const updatedConstants = constants.filter((c) => c.id !== id);
		setConstants(updatedConstants);
		updateViewDefinition(updatedConstants);
	};

	// Function to add a new where condition
	const addWhereCondition = () => {
		const newWhere = {
			id: `where-${whereConditions.length}-${crypto.randomUUID()}`,
			name: "",
			value: "",
		};
		const updatedWhere = [...whereConditions, newWhere];
		setWhereConditions(updatedWhere);

		// Remove the new where condition and its parent from collapsed items to ensure they're visible
		const newCollapsedIds = collapsedItemIds.filter(
			(id) => id !== newWhere.id && id !== "_where",
		);
		setCollapsedItemIds(newCollapsedIds);

		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to update a specific where condition
	const updateWhereCondition = (
		id: string,
		field: "name" | "value",
		value: string,
	) => {
		const updatedWhere = whereConditions.map((w) =>
			w.id === id ? { ...w, [field]: value } : w,
		);
		setWhereConditions(updatedWhere);
		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to remove a where condition
	const removeWhereCondition = (id: string) => {
		const updatedWhere = whereConditions.filter((w) => w.id !== id);
		setWhereConditions(updatedWhere);
		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to update name field
	const updateName = (name: string) => {
		updateViewDefinition(undefined, undefined, { name });
	};

	// Function to add a new select item
	const addSelectItem = (
		type: "column" | "forEach" | "forEachOrNull" | "unionAll",
		parentPath?: string[],
	) => {
		const newItem: any = {
			id: `${type}-${Date.now()}-${crypto.randomUUID()}`,
			type,
		};

		if (type === "column") {
			newItem.columns = [
				{
					id: `col-${Date.now()}-${crypto.randomUUID()}`,
					name: "",
					path: "",
				},
			];
		} else if (type === "forEach" || type === "forEachOrNull") {
			newItem.expression = "";
			newItem.children = [];
		} else if (type === "unionAll") {
			newItem.children = [];
		}

		// Remove newly added items from collapsed list to ensure they're visible
		const idsToRemove = [newItem.id, "_select"];

		// Also remove parent path IDs from collapsed list
		if (parentPath) {
			idsToRemove.push(...parentPath);
		}

		// If it's a column type, ensure columns and add button are visible
		if (type === "column" && newItem.columns) {
			newItem.columns.forEach((col: any) => {
				idsToRemove.push(col.id);
			});
			idsToRemove.push(`${newItem.id}_add_column`);
		} else if (
			type === "forEach" ||
			type === "forEachOrNull" ||
			type === "unionAll"
		) {
			// Ensure the "add select" button is visible
			idsToRemove.push(`${newItem.id}_add_select`);
		}

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => !idsToRemove.includes(id),
		);

		setCollapsedItemIds(newCollapsedIds);

		if (parentPath) {
			// Add to nested location
			const updatedItems = JSON.parse(JSON.stringify(selectItems));
			let target = updatedItems;
			for (const id of parentPath) {
				const item = target.find((i: any) => i.id === id);
				if (item && item.children) {
					target = item.children;
				}
			}
			target.push(newItem);
			setSelectItems(updatedItems);
			updateViewDefinition(undefined, undefined, undefined, updatedItems);
		} else {
			// Add to root level
			const updatedItems = [...selectItems, newItem];
			setSelectItems(updatedItems);
			updateViewDefinition(undefined, undefined, undefined, updatedItems);
		}
	};

	// Function to add a column to a column-type select item
	const addColumnToSelectItem = (selectItemId: string) => {
		const newColumnId = `col-${Date.now()}-${crypto.randomUUID()}`;

		// Find the path to the select item to ensure all parents are expanded
		const parentPath = findPath(selectItems, selectItemId);

		// Recursive function to update nested items
		const addColumnRecursive = (items: any[]): any[] => {
			return items.map((item) => {
				if (item.id === selectItemId && item.type === "column") {
					return {
						...item,
						columns: [
							...(item.columns || []),
							{
								id: newColumnId,
								name: "",
								path: "",
							},
						],
					};
				}
				// Recursively check children
				if (item.children) {
					return {
						...item,
						children: addColumnRecursive(item.children),
					};
				}
				return item;
			});
		};

		const updatedItems = addColumnRecursive(selectItems);

		// Remove new column, parent items, and path items from collapsed list to ensure they're visible
		const idsToRemove = [newColumnId, selectItemId, "_select"];
		if (parentPath) {
			idsToRemove.push(...parentPath);
		}

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => !idsToRemove.includes(id),
		);
		setCollapsedItemIds(newCollapsedIds);

		setSelectItems(updatedItems);
		updateViewDefinition(undefined, undefined, undefined, updatedItems);
	};

	// Function to update a column in a select item
	const updateSelectColumn = (
		selectItemId: string,
		columnId: string,
		field: "name" | "path",
		value: string,
	) => {
		const updateColumns = (items: any[]): any[] => {
			return items.map((item) => {
				if (item.id === selectItemId && item.columns) {
					return {
						...item,
						columns: item.columns.map((col: any) =>
							col.id === columnId ? { ...col, [field]: value } : col,
						),
					};
				}
				if (item.children) {
					return { ...item, children: updateColumns(item.children) };
				}
				return item;
			});
		};

		const updatedItems = updateColumns(selectItems);
		setSelectItems(updatedItems);
		updateViewDefinition(undefined, undefined, undefined, updatedItems);
	};

	// Function to update expression for forEach/forEachOrNull
	const updateSelectExpression = (selectItemId: string, expression: string) => {
		const updateExpression = (items: any[]): any[] => {
			return items.map((item) => {
				if (
					item.id === selectItemId &&
					(item.type === "forEach" || item.type === "forEachOrNull")
				) {
					return { ...item, expression };
				}
				if (item.children) {
					return { ...item, children: updateExpression(item.children) };
				}
				return item;
			});
		};

		const updatedItems = updateExpression(selectItems);
		setSelectItems(updatedItems);
		updateViewDefinition(undefined, undefined, undefined, updatedItems);
	};

	// Function to remove a column from a select item
	const removeSelectColumn = (selectItemId: string, columnId: string) => {
		const removeColumn = (items: any[]): any[] => {
			return items.map((item) => {
				if (item.id === selectItemId && item.columns) {
					return {
						...item,
						columns: item.columns.filter((col: any) => col.id !== columnId),
					};
				}
				if (item.children) {
					return { ...item, children: removeColumn(item.children) };
				}
				return item;
			});
		};

		const updatedItems = removeColumn(selectItems);
		setSelectItems(updatedItems);
		updateViewDefinition(undefined, undefined, undefined, updatedItems);
	};

	// Function to remove a select item
	const removeSelectItem = (itemId: string) => {
		const removeItem = (items: any[]): any[] => {
			return items
				.filter((item) => item.id !== itemId)
				.map((item) => {
					if (item.children) {
						return { ...item, children: removeItem(item.children) };
					}
					return item;
				});
		};

		const updatedItems = removeItem(selectItems);
		setSelectItems(updatedItems);
		updateViewDefinition(undefined, undefined, undefined, updatedItems);
	};

	// Dynamic tree generation based on current constants and where conditions
	const tree: Record<string, TreeViewItem<any>> = useMemo(() => {
		const constantChildren =
			constants.length > 0 ? constants.map((c) => c.id) : [];
		constantChildren.push("_constant_add");

		const whereChildren =
			whereConditions.length > 0 ? whereConditions.map((w) => w.id) : [];
		whereChildren.push("_where_add");

		// Initialize tree structure first
		const treeStructure: Record<string, TreeViewItem<any>> = {};

		// Build tree for nested select items
		const buildSelectTree = (items: any[], parentId = ""): string[] => {
			const children: string[] = [];

			items.forEach((item) => {
				children.push(item.id);

				// Add item to tree structure
				treeStructure[item.id] = {
					name: item.id,
					meta: {
						type: `select-${item.type}`,
						selectData: item,
					},
					children: [],
				};

				if (item.type === "column" && item.columns) {
					const columnChildren: string[] = [];
					item.columns.forEach((col: any) => {
						columnChildren.push(col.id);
						treeStructure[col.id] = {
							name: col.id,
							meta: {
								type: "column-item",
								columnData: col,
								selectItemId: item.id,
							},
						};
					});
					columnChildren.push(`${item.id}_add_column`);
					treeStructure[`${item.id}_add_column`] = {
						name: `${item.id}_add_column`,
						meta: {
							type: "column-add",
							selectItemId: item.id,
						},
					};
					treeStructure[item.id].children = columnChildren;
				} else if (
					item.type === "forEach" ||
					item.type === "forEachOrNull" ||
					item.type === "unionAll"
				) {
					// Handle forEach, forEachOrNull, and unionAll nodes
					const nodeChildren: string[] = [];

					// If there are existing children, add them to the tree
					if (item.children && item.children.length > 0) {
						const nestedChildren = buildSelectTree(item.children, item.id);
						nodeChildren.push(...nestedChildren);
					}

					// Always add the "add select" button for these types
					nodeChildren.push(`${item.id}_add_select`);
					treeStructure[`${item.id}_add_select`] = {
						name: `${item.id}_add_select`,
						meta: {
							type: "select-add-nested",
							parentId: item.id,
						},
					};

					treeStructure[item.id].children = nodeChildren;
				}
			});

			return children;
		};

		// Now populate the base structure
		Object.assign(treeStructure, {
			root: {
				name: "root",
				children: ["viewDefinition"],
			},
			viewDefinition: {
				name: "ViewDefinition",
				children: ["_name", "_constant", "_where", "_select"],
			},
			_name: {
				name: "_name",
				meta: {
					type: "name",
				},
			},
			_constant: {
				name: "_constant",
				meta: {
					type: "constant",
				},
				children: constantChildren,
			},
			_constant_add: {
				name: "_constant_add",
				meta: {
					type: "constant-add",
				},
			},
			_where: {
				name: "_where",
				meta: {
					type: "where",
				},
				children: whereChildren,
			},
			_where_add: {
				name: "_where_add",
				meta: {
					type: "where-add",
				},
			},
			_select: {
				name: "_select",
				meta: {
					type: "select",
				},
				children: [...buildSelectTree(selectItems), "_select_add"],
			},
			_select_add: {
				name: "_select_add",
				meta: {
					type: "select-add",
				},
			},
		});

		// Add each constant as a tree node
		constants.forEach((constant, index) => {
			treeStructure[constant.id] = {
				name: constant.id,
				meta: {
					type: "constant-value",
					lastNode: index === constants.length - 1,
					constantData: constant,
				},
			};
		});

		// Add each where condition as a tree node
		whereConditions.forEach((whereCondition, index) => {
			treeStructure[whereCondition.id] = {
				name: whereCondition.id,
				meta: {
					type: "where-value",
					lastNode: index === whereConditions.length - 1,
					whereData: whereCondition,
				},
			};
		});

		return treeStructure;
	}, [constants, whereConditions, selectItems]);

	const onSelectTreeItem = (item: ItemInstance<TreeViewItem<any>>) => {
		if (item.isFolder()) {
			if (item.isExpanded()) {
				const newItems = collapsedItemIds.filter((id) => id !== item.getId());
				if (newItems.length !== collapsedItemIds.length) {
					setCollapsedItemIds(newItems);
				}
			} else {
				setCollapsedItemIds([...collapsedItemIds, item.getId()]);
			}
		}
	};

	const labelView = (item: ItemInstance<TreeViewItem<any>>) => {
		const metaType = item.getItemData()?.meta?.type;
		const selectData = item.getItemData()?.meta?.selectData;
		let additionalClass = "";
		let label = metaType;

		if (metaType === "column") {
			// Green color scheme for column
			additionalClass = "text-[#009906] bg-[#E5FAE8]";
		} else if (metaType?.startsWith("select-")) {
			// For select nodes, use the type as label
			if (selectData?.type === "column") {
				label = "column";
				additionalClass = "text-[#009906] bg-[#E5FAE8]";
			} else if (selectData?.type === "forEach") {
				label = "forEach";
				additionalClass = "text-[#5C8DD6] bg-[#E8F2FC]";
			} else if (selectData?.type === "forEachOrNull") {
				label = "forEachOrNull";
				additionalClass = "text-[#5C8DD6] bg-[#E8F2FC]";
			} else if (selectData?.type === "unionAll") {
				label = "unionAll";
				additionalClass = "text-[#E07B39] bg-[#FFF4EC]";
			}
		} else if (
			metaType === "name" ||
			metaType === "resource" ||
			metaType === "constant" ||
			metaType === "select" ||
			metaType === "where"
		) {
			// Purple color scheme for other structural nodes
			additionalClass = "text-[#765FC9] bg-[#F1EFFA]";
		}

		const onLabelClickFn = () => {
			if (item.isExpanded()) {
				item.collapse();
			} else {
				item.expand();
			}
			onSelectTreeItem(item);
		};

		return (
			<span
				className={`uppercase px-1.5 py-0.5 rounded-md ${additionalClass}`}
				onClick={onLabelClickFn}
			>
				{label}
			</span>
		);
	};

	const InputView = ({
		placeholder,
		className,
		value,
		onBlur,
	}: {
		placeholder: string;
		className?: string;
		value?: string;
		onBlur?: (value: string) => void;
	}) => {
		const [localValue, setLocalValue] = useState(value || "");

		// Update local value when prop changes
		useEffect(() => {
			setLocalValue(value || "");
		}, [value]);

		return (
			<Input
				className={`h-6 py-0 px-1.5 ${className}`}
				placeholder={placeholder}
				value={localValue}
				onChange={(e) => setLocalValue(e.target.value)}
				onBlur={() => {
					if (onBlur && localValue !== value) {
						onBlur(localValue);
					}
				}}
			/>
		);
	};

	const customItemView = (item: ItemInstance<TreeViewItem<any>>) => {
		const metaType = item.getItemData()?.meta?.type;
		switch (metaType) {
			case "name":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="ViewDefinition name"
								value={viewDefinition.name || ""}
								onBlur={(value) => updateName(value)}
							/>
						</div>
					</div>
				);
			case "constant":
				return <div>{labelView(item)}</div>;
			case "select":
				return <div>{labelView(item)}</div>;
			case "column":
				return <div>{labelView(item)}</div>;
			case "where":
				return <div>{labelView(item)}</div>;
			case "select-add":
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="link" size="small" className="px-0" asChild>
								<span className="flex items-center gap-1">
									<PlusIcon size={16} strokeWidth={3} />
									<span className="typo-label">Select</span>
									<ChevronDown size={14} />
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onSelect={() => {
									addSelectItem("column");
								}}
							>
								Column
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									addSelectItem("forEach");
								}}
							>
								forEach
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									addSelectItem("forEachOrNull");
								}}
							>
								forEachOrNull
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									addSelectItem("unionAll");
								}}
							>
								unionAll
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			case "select-add-nested": {
				const parentId = item.getItemData()?.meta?.parentId;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="link" size="small" className="px-0">
								<PlusIcon size={16} strokeWidth={3} />
								<span className="typo-label">Select</span>
								<ChevronDown size={14} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId);
									addSelectItem(
										"column",
										path ? [...path, parentId] : [parentId],
									);
								}}
							>
								Column
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId);
									addSelectItem(
										"forEach",
										path ? [...path, parentId] : [parentId],
									);
								}}
							>
								forEach
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId);
									addSelectItem(
										"forEachOrNull",
										path ? [...path, parentId] : [parentId],
									);
								}}
							>
								forEachOrNull
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId);
									addSelectItem(
										"unionAll",
										path ? [...path, parentId] : [parentId],
									);
								}}
							>
								unionAll
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			}
			case "select-column": {
				const selectData = item.getItemData()?.meta?.selectData;
				if (!selectData || selectData.type !== "column") return null;

				return <div>{labelView(item)}</div>;
			}
			case "select-forEach":
			case "select-forEachOrNull": {
				const selectData = item.getItemData()?.meta?.selectData;
				if (!selectData) return null;

				const type =
					selectData.type === "forEach" ? "forEach" : "forEachOrNull";

				return (
					<div className="flex items-center w-full gap-2">
						{labelView(item)}
						<InputView
							placeholder="Expression"
							value={selectData.expression || ""}
							onBlur={(value) => updateSelectExpression(selectData.id, value)}
							className="flex-1"
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeSelectItem(selectData.id)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</Button>
					</div>
				);
			}
			case "select-unionAll": {
				const selectData = item.getItemData()?.meta?.selectData;
				if (!selectData) return null;

				return (
					<div className="flex items-center w-full gap-2">
						{labelView(item)}
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity ml-auto"
							onClick={() => removeSelectItem(selectData.id)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</Button>
					</div>
				);
			}
			case "column-item": {
				const columnData = item.getItemData()?.meta?.columnData;
				const selectItemId = item.getItemData()?.meta?.selectItemId;
				if (!columnData || !selectItemId) return null;

				return (
					<div className="flex items-center w-full gap-2">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<TextQuote size={12} />
						</span>
						<InputView
							placeholder="Column name"
							value={columnData.name}
							onBlur={(value) =>
								updateSelectColumn(selectItemId, columnData.id, "name", value)
							}
						/>
						<InputView
							placeholder="Path"
							value={columnData.path}
							onBlur={(value) =>
								updateSelectColumn(selectItemId, columnData.id, "path", value)
							}
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeSelectColumn(selectItemId, columnData.id)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</Button>
					</div>
				);
			}
			case "column-add": {
				const selectItemId = item.getItemData()?.meta?.selectItemId;
				return (
					<Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addColumnToSelectItem(selectItemId)}
						asChild
					>
						<span>
							<PlusIcon size={16} strokeWidth={3} />
							<span className="typo-label">Column</span>
						</span>
					</Button>
				);
			}
			case "where-add":
				return (
					<Button
						variant="link"
						size="small"
						className="px-0"
						onClick={addWhereCondition}
						asChild
					>
						<span>
							<PlusIcon size={16} strokeWidth={3} />
							<span className="typo-label">Where</span>
						</span>
					</Button>
				);
			case "where-value": {
				const whereData = item.getItemData()?.meta?.whereData;
				if (!whereData) return null;

				return (
					<div className="flex items-center w-full gap-2">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<Funnel size={12} />
						</span>
						<InputView
							placeholder="Where name"
							value={whereData.name}
							onBlur={(value) =>
								updateWhereCondition(whereData.id, "name", value)
							}
						/>
						<InputView
							placeholder="Where value"
							value={whereData.value}
							onBlur={(value) =>
								updateWhereCondition(whereData.id, "value", value)
							}
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeWhereCondition(whereData.id)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</Button>
					</div>
				);
			}
			case "constant-add":
				return (
					<Button
						variant="link"
						size="small"
						className="px-0"
						onClick={addConstant}
						asChild
					>
						<span>
							<PlusIcon size={16} strokeWidth={3} />
							<span className="typo-label">Constant</span>
						</span>
					</Button>
				);
			case "constant-value": {
				const constantData = item.getItemData()?.meta?.constantData;
				if (!constantData) return null;

				return (
					<div className="flex items-center w-full gap-2">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<Pi size={12} />
						</span>
						<InputView
							placeholder="Name"
							value={constantData.name}
							onBlur={(value) => updateConstant(constantData.id, "name", value)}
						/>
						<InputView
							placeholder="Value"
							value={constantData.valueString}
							onBlur={(value) =>
								updateConstant(constantData.id, "valueString", value)
							}
						/>

						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeConstant(constantData.id)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</Button>
					</div>
				);
			}
		}
	};

	// Calculate expandedItemIds: all tree item IDs except those in collapsedItemIds
	const expandedItemIds = useMemo(() => {
		const allItemIds = Object.keys(tree);
		return allItemIds.filter((id) => !collapsedItemIds.includes(id));
	}, [tree, collapsedItemIds]);

	// Initialize the tree keys on first render
	useEffect(() => {
		if (previousTreeKeysRef.current === "") {
			previousTreeKeysRef.current = Object.keys(tree).sort().join(",");
		}
	}, [tree]);

	return (
		<TreeView
			key={`tree-${selectItems.length}-${constants.length}-${whereConditions.length}`}
			onSelectItem={onSelectTreeItem}
			items={tree}
			rootItemId="root"
			expandedItemIds={expandedItemIds}
			customItemView={customItemView}
			disableHover={true}
		/>
	);
};

function LeftPanel({
	onRunResponse,
	routeId,
	setRunResponseVersion,
	viewDefinition,
	isLoadingViewDef,
	onViewDefinitionUpdate,
}: {
	onRunResponse: (response: string | null) => void;
	routeId: string;
	setRunResponseVersion: (version: string) => void;
	viewDefinition: ViewDefinition | null;
	isLoadingViewDef: boolean;
	onViewDefinitionUpdate: (viewDef: ViewDefinition) => void;
}) {
	const [activeTab, setActiveTab] = useLocalStorage<"form" | "code" | "sql">({
		key: `viewDefinition-leftPanel-activeTab-${routeId}`,
		defaultValue: "form",
	});
	const [codeContent, setCodeContent] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [sqlContent, setSqlContent] = useState("");
	const [isLoadingSQL, setIsLoadingSQL] = useState(false);
	const [codeMode, setCodeMode] = useLocalStorage<"json" | "yaml">({
		key: `viewDefinition-leftPanel-codeMode-${routeId}`,
		defaultValue: "json",
	});

	// State for resource types dropdown
	const [resourceTypes, setResourceTypes] = useState<ComboboxOption[]>([]);
	const [isLoadingResourceTypes, setIsLoadingResourceTypes] = useState(false);

	// Local state for Form tab - doesn't sync until tab switch
	const [localFormViewDef, setLocalFormViewDef] =
		useState<ViewDefinition | null>(viewDefinition);
	// Local state for Code tab - stores the pending changes
	const [pendingCodeViewDef, setPendingCodeViewDef] =
		useState<ViewDefinition | null>(null);

	// Update local form state when parent viewDefinition changes
	useEffect(() => {
		setLocalFormViewDef(viewDefinition);
	}, [viewDefinition]);

	// Fetch resource types on component mount
	useEffect(() => {
		const loadResourceTypes = async () => {
			setIsLoadingResourceTypes(true);
			const options = await fetchResourceTypes();
			setResourceTypes(options);
			setIsLoadingResourceTypes(false);
		};

		loadResourceTypes();
	}, []);

	// Track previous activeTab to detect tab switches
	const prevActiveTabRef = useRef(activeTab);

	// Initialize code content on mount when Code tab is active or when switching to Code tab
	useEffect(() => {
		const isInitialLoad =
			prevActiveTabRef.current === activeTab && activeTab === "code";
		const isSwitchingToCode =
			prevActiveTabRef.current !== "code" && activeTab === "code";

		if ((isInitialLoad || isSwitchingToCode) && viewDefinition) {
			// Set content from viewDefinition when initially loading or switching to Code tab
			if (codeMode === "yaml") {
				setCodeContent(yaml.dump(viewDefinition, { indent: 2 }));
			} else {
				setCodeContent(JSON.stringify(viewDefinition, null, 2));
			}
		}

		prevActiveTabRef.current = activeTab;
	}, [activeTab, viewDefinition, codeMode]);

	// Handle tab changes with synchronization
	const handleTabChange = (newTab: string) => {
		const typedTab = newTab as "form" | "code" | "sql";

		// Sync data when switching tabs
		if (activeTab === "form" && typedTab === "code") {
			// Switching from Form to Code - sync form changes to parent
			if (localFormViewDef) {
				onViewDefinitionUpdate(localFormViewDef);
				// Update code content with the latest form data
				if (codeMode === "yaml") {
					setCodeContent(yaml.dump(localFormViewDef, { indent: 2 }));
				} else {
					setCodeContent(JSON.stringify(localFormViewDef, null, 2));
				}
			}
		} else if (activeTab === "code" && typedTab === "form") {
			// Switching from Code to Form - sync code changes to parent
			if (pendingCodeViewDef) {
				onViewDefinitionUpdate(pendingCodeViewDef);
				setLocalFormViewDef(pendingCodeViewDef);
				setPendingCodeViewDef(null); // Clear pending changes
			}
		}

		setActiveTab(typedTab);
	};

	// Update ViewDefinition when code content changes (store locally, don't sync)
	const handleCodeContentChange = useCallback(
		(value: string) => {
			setCodeContent(value || "");

			// Try to parse and store locally - don't sync until tab switch
			try {
				let parsedViewDef: any;
				if (codeMode === "yaml") {
					parsedViewDef = yaml.load(value || "");
				} else {
					parsedViewDef = JSON.parse(value || "{}");
				}

				// Only store if parsing was successful and it's a valid ViewDefinition
				if (parsedViewDef && typeof parsedViewDef === "object") {
					setPendingCodeViewDef(parsedViewDef);
				}
			} catch (error) {
				// Ignore parsing errors - user might still be typing
				setPendingCodeViewDef(null); // Clear pending if invalid
			}
		},
		[codeMode],
	);

	const handleFormatCode = () => {
		const formattedContent = formatCode(codeContent, codeMode);
		setCodeContent(formattedContent);
	};

	useEffect(() => {
		const loadSQL = async () => {
			if (activeTab === "sql" && viewDefinition) {
				setIsLoadingSQL(true);
				const sqlContent = await fetchSQL(viewDefinition);
				setSqlContent(sqlContent);
				setIsLoadingSQL(false);
			}
		};

		loadSQL();
	}, [activeTab, viewDefinition]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			let viewDefinitionToSave: any;

			// Use the current tab's state
			if (activeTab === "form") {
				viewDefinitionToSave = localFormViewDef;
			} else if (activeTab === "code") {
				try {
					viewDefinitionToSave = parseViewDefinition(codeContent, codeMode);
				} catch (parseError) {
					// Invalid JSON/YAML in code editor
					toast.error(
						<div className="flex flex-col gap-1">
							<span className="typo-body">Failed to save</span>
							<span className="typo-code text-text-secondary">
								Invalid {codeMode.toUpperCase()} in code editor
							</span>
						</div>,
						{ duration: 3000 },
					);
					setIsSaving(false);
					return;
				}
			} else {
				toast.error("Cannot save from SQL tab");
				setIsSaving(false);
				return;
			}

			const response = await saveViewDefinition(viewDefinitionToSave, routeId);
			const isSuccess = checkSaveSuccess(response);

			if (isSuccess) {
				try {
					const parsedBody = JSON.parse(response.body);
					onViewDefinitionUpdate(parsedBody);
					// Also update local states to reflect saved data
					setLocalFormViewDef(parsedBody);
					setPendingCodeViewDef(null);
				} catch {
					// If parsing fails, still update with the original viewDefinition
					onViewDefinitionUpdate(viewDefinitionToSave);
					setLocalFormViewDef(viewDefinitionToSave);
					setPendingCodeViewDef(null);
				}
				toast.success(
					<div className="flex flex-col gap-1">
						<span className="typo-body">Successfully saved</span>
						<span className="typo-code text-text-secondary">
							ViewDefinition/{routeId}
						</span>
					</div>,
					{ duration: 2000 },
				);
			} else {
				// Error response
				let errorMessage = "Failed to save ViewDefinition";
				try {
					const errorBody = JSON.parse(response.body);
					errorMessage = errorBody.error || errorBody.message || errorMessage;
				} catch {
					errorMessage = response.body || errorMessage;
				}
				toast.error(
					<div className="flex flex-col gap-1">
						<span className="typo-body">Failed to save</span>
						<span className="typo-code text-text-secondary">
							{errorMessage}
						</span>
					</div>,
					{ duration: 3000 },
				);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			toast.error(
				<div className="flex flex-col gap-1">
					<span className="typo-body">Failed to save</span>
					<span className="typo-code text-text-secondary">{errorMessage}</span>
				</div>,
				{ duration: 3000 },
			);
		} finally {
			setIsSaving(false);
		}
	};

	const handleRun = async () => {
		setIsLoading(true);
		try {
			let viewDefinitionToRun: any;

			// Use the current tab's state
			if (activeTab === "form") {
				viewDefinitionToRun = localFormViewDef;
			} else if (activeTab === "code") {
				try {
					viewDefinitionToRun = parseViewDefinition(codeContent, codeMode);
				} catch (parseError) {
					// Invalid JSON/YAML in code editor
					onRunResponse(
						JSON.stringify(
							{ error: `Invalid ${codeMode.toUpperCase()} in code editor` },
							null,
							2,
						),
					);
					setIsLoading(false);
					return;
				}
			} else {
				toast.error("Cannot run from SQL tab");
				setIsLoading(false);
				return;
			}

			const response = await runViewDefinition(viewDefinitionToRun);
			const result = processRunResponse(response);

			if (!result.success && result.diagnostics) {
				toast.error(
					<div className="flex flex-col gap-1">
						<span className="typo-body">Failed to run ViewDefinition</span>
						<div className="flex flex-col gap-1">
							{result.diagnostics.map((diagnostic: string, index: number) => (
								<span key={index} className="typo-code text-text-secondary">
									• {diagnostic}
								</span>
							))}
						</div>
					</div>,
					{ duration: 5000 },
				);
			} else if (!result.success) {
				toast.error(
					<div className="flex flex-col gap-1">
						<span className="typo-body">Failed to run ViewDefinition</span>
						<span className="typo-code text-text-secondary">
							{(result.data as any)?.issue?.[0]?.code ||
								"Unknown error occurred"}
						</span>
					</div>,
					{ duration: 5000 },
				);
			}

			onRunResponse(JSON.stringify(result.data, null, 2));
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			onRunResponse(JSON.stringify({ error: errorMessage }, null, 2));
		} finally {
			setRunResponseVersion(crypto.randomUUID());
			setIsLoading(false);
		}
	};

	// Function to update resource field
	const updateResource = (resource: string) => {
		if (activeTab === "form") {
			setLocalFormViewDef((prev) => ({
				...(prev || viewDefinition || { resourceType: "ViewDefinition" }),
				resource,
			}));
		} else {
			onViewDefinitionUpdate({
				...(viewDefinition || { resourceType: "ViewDefinition" }),
				resource,
			});
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 bg-bg-secondary px-4 py-3 border-b">
				<span className="typo-label text-text-secondary whitespace-nowrap">
					View definition resource type:
				</span>
				<Combobox
					options={resourceTypes}
					value={
						(activeTab === "form" ? localFormViewDef : viewDefinition)
							?.resource || ""
					}
					onValueChange={(value) => updateResource(value)}
					placeholder="Select resource type..."
					searchPlaceholder="Search resources..."
					emptyText="No resource types found"
					disabled={isLoadingResourceTypes}
					className="h-8 flex-1 max-w-xs"
				/>
			</div>
			<Tabs value={activeTab} onValueChange={handleTabChange}>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
					<div className="flex items-center gap-8">
						<span className="typo-label text-text-secondary truncate">
							View Definition:
						</span>
						<TabsList>
							<TabsTrigger value="form" className="px-0 mr-6">
								Form
							</TabsTrigger>
							<TabsTrigger value="code" className="px-0 mr-6">
								Code
							</TabsTrigger>
							<TabsTrigger value="sql" className="px-0">
								SQL
							</TabsTrigger>
						</TabsList>
					</div>
				</div>
				<div className="flex flex-col grow min-h-0">
					<TabsContent value="form" className="grow min-h-0">
						{localFormViewDef && (
							<ViewDefinitionForm
								viewDefinition={localFormViewDef}
								onUpdate={setLocalFormViewDef}
							/>
						)}
					</TabsContent>
					<TabsContent value="code" className="grow min-h-0">
						{isLoadingViewDef ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Loading ViewDefinition...</div>
									<div className="text-sm">Fetching content from Aidbox</div>
								</div>
							</div>
						) : (
							<div className="relative h-full w-full">
								<div className="absolute top-2 right-3 z-10">
									<CodeEditorMenu
										mode={codeMode}
										onModeChange={(newMode) => {
											// Parse current content and convert to new format
											try {
												const parsed = parseViewDefinition(
													codeContent,
													codeMode,
												);
												if (newMode === "yaml") {
													setCodeContent(yaml.dump(parsed, { indent: 2 }));
												} else {
													setCodeContent(JSON.stringify(parsed, null, 2));
												}
												// Update the pending view definition
												setPendingCodeViewDef(parsed);
												// Update the parent view definition immediately
												onViewDefinitionUpdate(parsed);
											} catch (error) {
												// If parsing fails, just switch mode without converting
												console.error(
													"Failed to parse content for format conversion:",
													error,
												);
											}
											setCodeMode(newMode);
										}}
										textToCopy={codeContent}
										onFormat={handleFormatCode}
									/>
								</div>
								<CodeEditor
									currentValue={codeContent}
									onChange={handleCodeContentChange}
									mode={codeMode === "yaml" ? "yaml" : "json"}
								/>
							</div>
						)}
					</TabsContent>
					<TabsContent value="sql" className="grow min-h-0">
						{isLoadingSQL ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Loading SQL...</div>
									<div className="text-sm">
										Generating SQL query from ViewDefinition
									</div>
								</div>
							</div>
						) : (
							<CodeEditor
								readOnly={true}
								currentValue={sqlContent}
								mode="sql"
							/>
						)}
					</TabsContent>
				</div>
				<div className="border-t p-3 flex justify-end gap-2">
					<Button variant="secondary" onClick={handleSave} disabled={isSaving}>
						<Save className="w-4 h-4" />
						Save
					</Button>
					<Button variant="primary" onClick={handleRun} disabled={isLoading}>
						<PlayIcon />
						Run
					</Button>
				</div>
			</Tabs>
		</div>
	);
}



const PageComponent = () => {
	const { id } = Route.useParams();
	return <ViewDefinitionPage id={id} />;
};

// function PageComponent() {
// 	const { id } = Route.useParams();
// 	const [runResponse, setRunResponse] = useState<string | null>(null);
// 	const [runResponseVersion, setRunResponseVersion] = useState<string>(
// 		crypto.randomUUID(),
// 	);

// 	const [viewDefinition, setViewDefinition] = useState<ViewDefinition | null>(
// 		null,
// 	);
// 	const [isLoadingViewDef, setIsLoadingViewDef] = useState(false);

// 	useEffect(() => {
// 		const fetchViewDefinition = async () => {
// 			setIsLoadingViewDef(true);
// 			try {
// 				const fetchedViewDefinition = await AidboxCall<ViewDefinition>({
// 					method: "GET",
// 					url: `/fhir/ViewDefinition/${id}`,
// 					headers: {
// 						"Content-Type": "application/json",
// 						Accept: "application/json",
// 					},
// 				});

// 				if (fetchedViewDefinition) {
// 					setViewDefinition(fetchedViewDefinition);
// 				}
// 			} catch (error) {
// 				const errorMessage =
// 					error instanceof Error ? error.message : "Unknown error occurred";
// 				setRunResponse(
// 					JSON.stringify(
// 						{ error: `Failed to fetch ViewDefinition: ${errorMessage}` },
// 						null,
// 						2,
// 					),
// 				);
// 			} finally {
// 				setIsLoadingViewDef(false);
// 			}
// 		};

// 		if (id) {
// 			fetchViewDefinition();
// 		}
// 	}, [id]);

// 	return (
// 		<div className="flex flex-col h-full">
// 			<ResizablePanelGroup
// 				direction="vertical"
// 				className="grow"
// 				autoSaveId={`view-definition-vertical-${id}`}
// 			>
// 				<ResizablePanel defaultSize={70} className="min-h-[200px]">
// 					<ResizablePanelGroup
// 						direction="horizontal"
// 						className="h-full"
// 						autoSaveId={`view-definition-horizontal-${id}`}
// 					>
// 						<ResizablePanel defaultSize={50} minSize={20}>
// 							<LeftPanel
// 								onRunResponse={setRunResponse}
// 								routeId={id}
// 								setRunResponseVersion={setRunResponseVersion}
// 								viewDefinition={viewDefinition}
// 								isLoadingViewDef={isLoadingViewDef}
// 								onViewDefinitionUpdate={setViewDefinition}
// 							/>
// 						</ResizablePanel>
// 						<ResizableHandle />
// 						<ResizablePanel defaultSize={50} minSize={20}>
// 							<RightPanel
// 								routeId={id}
// 								viewDefinition={viewDefinition}
// 								isLoadingViewDef={isLoadingViewDef}
// 							/>
// 						</ResizablePanel>
// 					</ResizablePanelGroup>
// 				</ResizablePanel>
// 				<ResizableHandle />
// 				<ResizablePanel defaultSize={30} className="min-h-[150px]">
// 					<BottomPanel response={runResponse} version={runResponseVersion} />
// 				</ResizablePanel>
// 			</ResizablePanelGroup>
// 		</div>
// 	);
// }
