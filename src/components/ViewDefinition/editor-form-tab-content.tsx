import {
	Button,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	type ItemInstance,
	MultiCombobox,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	type TreeInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import {
	ChevronDown,
	Funnel,
	GripVertical,
	Pi,
	PlusIcon,
	TextQuote,
	X,
} from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useDebounce, useLocalStorage } from "../../hooks";
import { ViewDefinitionContext } from "./page";
import type * as Types from "./types";

interface ConstantItem {
	id: string;
	name: string;
	valueString: string;
}

interface WhereItem {
	id: string;
	path: string;
}

interface ColumnItem {
	id: string;
	name: string;
	path: string;
}

interface SelectItemInternal {
	id: string;
	type: "column" | "forEach" | "forEachOrNull" | "unionAll";
	columns?: ColumnItem[];
	expression?: string;
	children?: SelectItemInternal[];
}

// Helper functions
const parseSelectItems = (
	items: Types.ViewDefinitionSelectItem[],
	parentId = "",
): SelectItemInternal[] => {
	return items
		.map((item, index) => {
			const id = `${parentId}select-${index}-${crypto.randomUUID()}`;

			if (item.column) {
				return {
					id,
					type: "column" as const,
					columns: item.column.map((c, idx) => ({
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
		.filter(Boolean) as SelectItemInternal[];
};

const buildSelectArray = (
	items: SelectItemInternal[],
): Types.ViewDefinitionSelectItem[] => {
	return items
		.map((item) => {
			if (item.type === "column" && item.columns) {
				return {
					column: item.columns.map((col) => ({
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
		.filter(Boolean) as Types.ViewDefinitionSelectItem[];
};

const findPath = (
	items: SelectItemInternal[],
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

const InputView = ({
	placeholder,
	className,
	value,
	onChange,
}: {
	placeholder: string;
	className?: string;
	value?: string;
	onChange?: (value: string) => void;
}) => {
	const [localValue, setLocalValue] = useState(value || "");

	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);

	const debouncedOnChange = useDebounce((newValue: string) => {
		if (onChange && newValue !== value) {
			onChange(newValue);
		}
	}, 350);

	const handleChange = (newValue: string) => {
		setLocalValue(newValue);
		debouncedOnChange(newValue);
	};

	return (
		<Input
			className={`h-7 py-1 px-2 ${className} bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary
			`}
			placeholder={placeholder}
			value={localValue}
			onChange={(e) => handleChange(e.target.value)}
		/>
	);
};

export const FormTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinition = viewDefinitionContext.viewDefinition;

	const [constants, setConstants] = useState<ConstantItem[]>([]);
	const [whereConditions, setWhereConditions] = useState<WhereItem[]>([]);
	const [selectItems, setSelectItems] = useState<SelectItemInternal[]>([]);
	const [collapsedItemIds, setCollapsedItemIds] = useLocalStorage<string[]>({
		key: `viewDefinition-form-collapsed-${viewDefinition?.id || "default"}`,
		defaultValue: [],
	});

	// Track the previous tree structure to detect changes
	const previousTreeKeysRef = useRef<string>("");

	// Initialize state from viewDefinition - only on initial load or when ID changes
	const [lastViewDefId, setLastViewDefId] = useState<string | null>(null);

	useEffect(() => {
		if (viewDefinition && viewDefinition.id !== lastViewDefId) {
			setLastViewDefId(viewDefinition.id || null);
			if (
				(viewDefinition as any)?.constant &&
				Array.isArray((viewDefinition as any).constant) &&
				(viewDefinition as any).constant.length > 0
			) {
				const constantsWithIds = (viewDefinition as any).constant.map(
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
				(viewDefinition as any)?.where &&
				Array.isArray((viewDefinition as any).where) &&
				(viewDefinition as any).where.length > 0
			) {
				const whereWithIds = (viewDefinition as any).where.map(
					(w: any, index: number) => ({
						id: `where-${index}-${crypto.randomUUID()}`,
						path: w.path || "",
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
			updatedConstants?: ConstantItem[],
			updatedWhere?: WhereItem[],
			updatedFields?: { name?: string },
			updatedSelectItems?: SelectItemInternal[],
		) => {
			if (viewDefinition) {
				const constantArray = (updatedConstants || constants).map((c) => ({
					name: c.name,
					valueString: c.valueString,
				}));

				const whereArray = (updatedWhere || whereConditions).map((w) => ({
					path: w.path,
				}));

				const selectArray = buildSelectArray(updatedSelectItems || selectItems);

				const updatedViewDef: any = {
					...viewDefinition,
					...(updatedFields || {}),
				};

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

				viewDefinitionContext.setViewDefinition(updatedViewDef);
			}
		},
		[
			viewDefinition,
			constants,
			whereConditions,
			selectItems,
			viewDefinitionContext,
		],
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
			path: "",
		};
		const updatedWhere = [...whereConditions, newWhere];
		setWhereConditions(updatedWhere);

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => id !== newWhere.id && id !== "_where",
		);
		setCollapsedItemIds(newCollapsedIds);

		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to update a specific where condition
	const updateWhereCondition = (id: string, path: string) => {
		const updatedWhere = whereConditions.map((w) =>
			w.id === id ? { ...w, path } : w,
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

	// Function to update title field
	const updateTitle = (title: string) => {
		updateViewDefinition(undefined, undefined, { title } as any);
	};

	// Function to update description field
	const updateDescription = (description: string) => {
		updateViewDefinition(undefined, undefined, { description } as any);
	};

	// Function to update status field
	const updateStatus = (status: string) => {
		updateViewDefinition(undefined, undefined, { status } as any);
	};

	// Function to update url field
	const updateUrl = (url: string) => {
		updateViewDefinition(undefined, undefined, { url } as any);
	};

	// Function to update publisher field
	const updatePublisher = (publisher: string) => {
		updateViewDefinition(undefined, undefined, { publisher } as any);
	};

	// Function to update copyright field
	const updateCopyright = (copyright: string) => {
		updateViewDefinition(undefined, undefined, { copyright } as any);
	};

	// Function to update experimental field
	const updateExperimental = (experimental: boolean) => {
		updateViewDefinition(undefined, undefined, { experimental } as any);
	};

	// Function to update fhirVersion field
	const updateFhirVersions = (fhirVersions: string[]) => {
		updateViewDefinition(undefined, undefined, {
			fhirVersion: fhirVersions.length > 0 ? fhirVersions : undefined,
		} as any);
	};

	// Function to add a new select item
	const addSelectItem = (
		type: "column" | "forEach" | "forEachOrNull" | "unionAll",
		parentPath?: string[],
	) => {
		const newItem: SelectItemInternal = {
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

		const idsToRemove = [newItem.id, "_select"];

		if (parentPath) {
			idsToRemove.push(...parentPath);
		}

		if (type === "column" && newItem.columns) {
			newItem.columns.forEach((col) => {
				idsToRemove.push(col.id);
			});
			idsToRemove.push(`${newItem.id}_add_column`);
		} else if (
			type === "forEach" ||
			type === "forEachOrNull" ||
			type === "unionAll"
		) {
			idsToRemove.push(`${newItem.id}_add_select`);
		}

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => !idsToRemove.includes(id),
		);

		setCollapsedItemIds(newCollapsedIds);

		if (parentPath) {
			const updatedItems = JSON.parse(JSON.stringify(selectItems));
			let target = updatedItems;
			for (const id of parentPath) {
				const item = target.find((i: SelectItemInternal) => i.id === id);
				if (item?.children) {
					target = item.children;
				}
			}
			target.push(newItem);
			setSelectItems(updatedItems);
			updateViewDefinition(undefined, undefined, undefined, updatedItems);
		} else {
			const updatedItems = [...selectItems, newItem];
			setSelectItems(updatedItems);
			updateViewDefinition(undefined, undefined, undefined, updatedItems);
		}
	};

	// Function to add a column to a column-type select item
	const addColumnToSelectItem = (selectItemId: string) => {
		const newColumnId = `col-${Date.now()}-${crypto.randomUUID()}`;

		const parentPath = findPath(selectItems, selectItemId);

		const addColumnRecursive = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
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
		const updateColumns = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
			return items.map((item) => {
				if (item.id === selectItemId && item.columns) {
					return {
						...item,
						columns: item.columns.map((col) =>
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
		const updateExpression = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
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
		const removeColumn = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
			return items.map((item) => {
				if (item.id === selectItemId && item.columns) {
					return {
						...item,
						columns: item.columns.filter((col) => col.id !== columnId),
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
		const removeItem = (items: SelectItemInternal[]): SelectItemInternal[] => {
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

		const treeStructure: Record<string, TreeViewItem<any>> = {};

		// Build tree for nested select items
		const buildSelectTree = (items: SelectItemInternal[]): string[] => {
			const children: string[] = [];

			items.forEach((item) => {
				children.push(item.id);

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
					item.columns.forEach((col) => {
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
					treeStructure[item.id]!.children = columnChildren;
				} else if (
					item.type === "forEach" ||
					item.type === "forEachOrNull" ||
					item.type === "unionAll"
				) {
					const nodeChildren: string[] = [];

					if (item.children && item.children.length > 0) {
						const nestedChildren = buildSelectTree(item.children);
						nodeChildren.push(...nestedChildren);
					}

					nodeChildren.push(`${item.id}_add_select`);
					treeStructure[`${item.id}_add_select`] = {
						name: `${item.id}_add_select`,
						meta: {
							type: "select-add-nested",
							parentId: item.id,
						},
					};

					treeStructure[item.id]!.children = nodeChildren;
				}
			});

			return children;
		};

		Object.assign(treeStructure, {
			root: {
				name: "root",
				children: ["_properties", "_constant", "_where", "_select"],
			},
			_properties: {
				name: "_properties",
				meta: {
					type: "properties",
				},
				children: [
					"_name",
					"_title",
					"_description",
					"_status",
					"_url",
					"_publisher",
					"_copyright",
					"_experimental",
					"_fhirVersion",
					"_identifier",
				],
			},
			_name: {
				name: "_name",
				meta: {
					type: "name",
				},
			},
			_title: {
				name: "_title",
				meta: {
					type: "title",
				},
			},
			_description: {
				name: "_description",
				meta: {
					type: "description",
				},
			},
			_status: {
				name: "_status",
				meta: {
					type: "status",
				},
			},
			_url: {
				name: "_url",
				meta: {
					type: "url",
				},
			},
			_publisher: {
				name: "_publisher",
				meta: {
					type: "publisher",
				},
			},
			_copyright: {
				name: "_copyright",
				meta: {
					type: "copyright",
				},
			},
			_experimental: {
				name: "_experimental",
				meta: {
					type: "experimental",
				},
			},
			_fhirVersion: {
				name: "_fhirVersion",
				meta: {
					type: "fhir version",
				},
			},
			_identifier: {
				name: "_identifier",
				children: ["_identifier_system", "_identifier_value"],
				meta: {
					type: "identifier",
				},
			},
			_identifier_system: {
				name: "_identifier_system",
				meta: {
					type: "system",
				},
			},
			_identifier_value: {
				name: "_identifier_value",
				meta: {
					type: "value",
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

	const onDropTreeItem = (
		_tree: TreeInstance<TreeViewItem<any>>,
		item: ItemInstance<TreeViewItem<any>>,
		newChildren: string[],
	) => {
		item.getItemData().children = newChildren;

		const itemId = item.getId();
		const _itemMeta = item.getItemData()?.meta;

		// Handle reordering of constants
		if (itemId === "_constant") {
			// Filter out the add button and reorder constants
			const reorderedConstantIds = newChildren.filter(
				(id) => id !== "_constant_add",
			);
			const reorderedConstants: ConstantItem[] = [];

			for (const id of reorderedConstantIds) {
				const constant = constants.find((c) => c.id === id);
				if (constant) {
					reorderedConstants.push(constant);
				}
			}

			if (reorderedConstants.length === constants.length) {
				setConstants(reorderedConstants);
				updateViewDefinition(reorderedConstants);
			}
		}

		// Handle reordering of where conditions
		else if (itemId === "_where") {
			// Filter out the add button and reorder where conditions
			const reorderedWhereIds = newChildren.filter((id) => id !== "_where_add");
			const reorderedWhere: WhereItem[] = [];

			for (const id of reorderedWhereIds) {
				const where = whereConditions.find((w) => w.id === id);
				if (where) {
					reorderedWhere.push(where);
				}
			}

			if (reorderedWhere.length === whereConditions.length) {
				setWhereConditions(reorderedWhere);
				updateViewDefinition(undefined, reorderedWhere);
			}
		}

		// Handle reordering of top-level select items
		else if (itemId === "_select") {
			// Filter out the add button and reorder select items
			const reorderedSelectIds = newChildren.filter(
				(id) => id !== "_select_add",
			);

			const reorderSelectItems = (
				items: SelectItemInternal[],
				orderedIds: string[],
			): SelectItemInternal[] => {
				const reordered: SelectItemInternal[] = [];
				for (const id of orderedIds) {
					const item = items.find((i) => i.id === id);
					if (item) {
						reordered.push(item);
					}
				}
				return reordered;
			};

			const reorderedSelect = reorderSelectItems(
				selectItems,
				reorderedSelectIds,
			);
			if (reorderedSelect.length === selectItems.length) {
				setSelectItems(reorderedSelect);
				updateViewDefinition(undefined, undefined, undefined, reorderedSelect);
			}
		}

		// Handle reordering within a select item (columns or nested selects)
		else {
			// First, try to find the item in the flat structure (could be a column node or nested select)
			const findAndUpdateItems = (
				items: SelectItemInternal[],
			): { updated: boolean; items: SelectItemInternal[] } => {
				let wasUpdated = false;
				const updatedItems = items.map((item) => {
					// Check if this item matches
					if (item.id === itemId) {
						if (item.type === "column" && item.columns) {
							// Reorder columns
							const reorderedColumnIds = newChildren.filter(
								(id) => !id.endsWith("_add_column"),
							);
							const reorderedColumns: ColumnItem[] = [];

							for (const id of reorderedColumnIds) {
								const column = item.columns.find((c) => c.id === id);
								if (column) {
									reorderedColumns.push(column);
								}
							}

							if (reorderedColumns.length === item.columns.length) {
								wasUpdated = true;
								return { ...item, columns: reorderedColumns };
							}
						} else if (
							(item.type === "forEach" ||
								item.type === "forEachOrNull" ||
								item.type === "unionAll") &&
							item.children
						) {
							// Reorder nested select items
							const reorderedChildIds = newChildren.filter(
								(id) => !id.endsWith("_add_select"),
							);
							const reorderedChildren: SelectItemInternal[] = [];

							for (const id of reorderedChildIds) {
								const child = item.children.find((c) => c.id === id);
								if (child) {
									reorderedChildren.push(child);
								}
							}

							if (reorderedChildren.length === item.children.length) {
								wasUpdated = true;
								return { ...item, children: reorderedChildren };
							}
						}
					}
					// If not matched, check children recursively
					else if (item.children && item.children.length > 0) {
						const result = findAndUpdateItems(item.children);
						if (result.updated) {
							wasUpdated = true;
							return { ...item, children: result.items };
						}
					}
					return item;
				});

				return { updated: wasUpdated, items: updatedItems };
			};

			const result = findAndUpdateItems(selectItems);
			if (result.updated) {
				setSelectItems(result.items);
				updateViewDefinition(undefined, undefined, undefined, result.items);
			}
		}
	};

	const labelView = (item: ItemInstance<TreeViewItem<any>>) => {
		const metaType = item.getItemData()?.meta?.type;
		const selectData = item.getItemData()?.meta?.selectData;
		const isFolder = item.isFolder();
		let additionalClass = "";
		let label = metaType;

		if (metaType === "column") {
			additionalClass = "text-blue-500 bg-blue-100";
		} else if (metaType?.startsWith("select-")) {
			if (selectData?.type === "column") {
				label = "column";
				additionalClass = "text-blue-500 bg-blue-100";
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
			metaType === "resource" ||
			metaType === "constant" ||
			metaType === "select" ||
			metaType === "where" ||
			metaType === "properties"
		) {
			additionalClass = "text-blue-500 px-1!";
		} else if (
			metaType === "name" ||
			metaType === "title" ||
			metaType === "description" ||
			metaType === "status" ||
			metaType === "url" ||
			metaType === "publisher" ||
			metaType === "copyright" ||
			metaType === "experimental" ||
			metaType === "fhir version" ||
			metaType === "system" ||
			metaType === "value" ||
			metaType === "identifier"
		)
			additionalClass = "text-blue-500 bg-blue-100";

		const onLabelClickFn = () => {
			if (item.isExpanded()) {
				item.collapse();
			} else {
				item.expand();
			}
		};

		return (
			<span
				className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
				onClick={onLabelClickFn}
			>
				{label}
			</span>
		);
	};

	const customItemView = (item: ItemInstance<TreeViewItem<any>>) => {
		const metaType = item.getItemData()?.meta?.type;
		const _itemId = item.getId();
		const _itemProps = item.getProps();

		// Helper function to render drag handle for draggable items
		const renderDragHandle = () => {
			// Only show drag handle for items that can be reordered
			const isDraggable =
				metaType === "constant-value" ||
				metaType === "where-value" ||
				metaType === "column-item" ||
				metaType?.startsWith("select-");

			if (!isDraggable) return null;

			return (
				<Button
					draggable
					data-slot="drag-handle"
					variant="link"
					size="small"
					className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
					onMouseDown={(e) => e.stopPropagation()}
					asChild
				>
					<span>
						<GripVertical size={16} />
					</span>
				</Button>
			);
		};

		switch (metaType) {
			case "name":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="ViewDefinition name"
								value={viewDefinition?.name || ""}
								onChange={(value) => updateName(value)}
							/>
						</div>
					</div>
				);
			case "title":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Title"
								value={(viewDefinition as any)?.title || ""}
								onChange={(value) => updateTitle(value)}
							/>
						</div>
					</div>
				);
			case "description":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Description"
								value={(viewDefinition as any)?.description || ""}
								onChange={(value) => updateDescription(value)}
							/>
						</div>
					</div>
				);
			case "status":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<Select
								value={(viewDefinition as any)?.status || ""}
								onValueChange={(value) => updateStatus(value)}
							>
								<SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<SelectValue placeholder="Select status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="draft">draft</SelectItem>
									<SelectItem value="active">active</SelectItem>
									<SelectItem value="retired">retired</SelectItem>
									<SelectItem value="unknown">unknown</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				);
			case "url":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="URL"
								value={(viewDefinition as any)?.url || ""}
								onChange={(value) => updateUrl(value)}
							/>
						</div>
					</div>
				);
			case "publisher":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Publisher"
								value={(viewDefinition as any)?.publisher || ""}
								onChange={(value) => updatePublisher(value)}
							/>
						</div>
					</div>
				);
			case "copyright":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Copyright"
								value={(viewDefinition as any)?.copyright || ""}
								onChange={(value) => updateCopyright(value)}
							/>
						</div>
					</div>
				);
			case "experimental":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%] flex items-center pl-2">
							<Checkbox
								checked={(viewDefinition as any)?.experimental || false}
								onCheckedChange={(checked) =>
									updateExperimental(checked === true)
								}
							/>
						</div>
					</div>
				);
			case "fhir version": {
				const fhirVersionOptions = [
					{ value: "6.0.0-ballot3", label: "6.0.0-ballot3" },
					{ value: "6.0.0-ballot2", label: "6.0.0-ballot2" },
					{ value: "6.0.0-ballot1", label: "6.0.0-ballot1" },
					{ value: "5.0.0", label: "5.0.0" },
					{ value: "5.0.0-draft-final", label: "5.0.0-draft-final" },
					{ value: "5.0.0-snapshot3", label: "5.0.0-snapshot3" },
					{ value: "5.0.0-ballot", label: "5.0.0-ballot" },
					{ value: "5.0.0-snapshot1", label: "5.0.0-snapshot1" },
					{ value: "4.6.0", label: "4.6.0" },
					{ value: "4.5.0", label: "4.5.0" },
					{ value: "4.4.0", label: "4.4.0" },
					{ value: "4.3.0", label: "4.3.0" },
					{ value: "4.3.0-snapshot1", label: "4.3.0-snapshot1" },
					{ value: "4.2.0", label: "4.2.0" },
					{ value: "4.1.0", label: "4.1.0" },
					{ value: "4.0.1", label: "4.0.1" },
					{ value: "4.0.0", label: "4.0.0" },
					{ value: "3.5a.0", label: "3.5a.0" },
					{ value: "3.5.0", label: "3.5.0" },
					{ value: "3.3.0", label: "3.3.0" },
					{ value: "3.2.0", label: "3.2.0" },
					{ value: "3.0.2", label: "3.0.2" },
					{ value: "3.0.1", label: "3.0.1" },
					{ value: "3.0.0", label: "3.0.0" },
				];
				const selectedVersions = (viewDefinition as any)?.fhirVersion || [];

				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<MultiCombobox
								options={fhirVersionOptions}
								value={selectedVersions}
								onValueChange={updateFhirVersions}
								placeholder="Select FHIR versions"
								searchPlaceholder="Search versions..."
								className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary"
							/>
						</div>
					</div>
				);
			}
			case "identifier":
				return <div>{labelView(item)}</div>;
			case "system":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Identifier system"
								value={(viewDefinition as any)?.identifier?.[0]?.system || ""}
								onChange={(value) => {
									const currentIdentifier =
										(viewDefinition as any)?.identifier?.[0] || {};
									updateViewDefinition(undefined, undefined, {
										identifier: [{ ...currentIdentifier, system: value }],
									} as any);
								}}
							/>
						</div>
					</div>
				);
			case "value":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<InputView
								placeholder="Identifier value"
								value={(viewDefinition as any)?.identifier?.[0]?.value || ""}
								onChange={(value) => {
									const currentIdentifier =
										(viewDefinition as any)?.identifier?.[0] || {};
									updateViewDefinition(undefined, undefined, {
										identifier: [{ ...currentIdentifier, value }],
									} as any);
								}}
							/>
						</div>
					</div>
				);
			case "properties":
				return <div>{labelView(item)}</div>;
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
			case "select-forEach":
			case "select-forEachOrNull": {
				const selectData = item.getItemData()?.meta?.selectData;
				if (!selectData) return null;

				return (
					<div className="flex items-center w-full gap-2">
						{labelView(item)}
						<InputView
							placeholder="Expression"
							value={selectData.expression || ""}
							onChange={(value) => updateSelectExpression(selectData.id, value)}
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
							onChange={(value) =>
								updateSelectColumn(selectItemId, columnData.id, "name", value)
							}
						/>
						<InputView
							placeholder="Path"
							value={columnData.path}
							onChange={(value) =>
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
						{renderDragHandle()}
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
							placeholder="Expression"
							value={whereData.path}
							onChange={(value) => updateWhereCondition(whereData.id, value)}
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
						{renderDragHandle()}
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
							<span className="text-xs typo-label ">Constant</span>
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
							onChange={(value) =>
								updateConstant(constantData.id, "name", value)
							}
						/>
						<InputView
							placeholder="Value"
							value={constantData.valueString}
							onChange={(value) =>
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
						{renderDragHandle()}
					</div>
				);
			}
		}
	};

	// Calculate expandedItemIds: all tree item IDs except those in collapsedItemIds
	const expandedItemIds = useMemo(() => {
		const allItemIds = Object.keys(tree).filter(
			(item) => item !== "_properties",
		);
		return allItemIds.filter((id) => !collapsedItemIds.includes(id));
	}, [tree, collapsedItemIds]);

	// Initialize the tree keys on first render
	useEffect(() => {
		if (previousTreeKeysRef.current === "") {
			previousTreeKeysRef.current = Object.keys(tree).sort().join(",");
		}
	}, [tree]);

	if (!viewDefinition) {
		return null;
	}

	return (
		<TreeView
			key={`tree-${selectItems.length}-${constants.length}-${whereConditions.length}`}
			itemLabelClassFn={(item: ItemInstance<TreeViewItem<any>>) => {
				const metaType = item.getItemData()?.meta?.type;

				if (
					metaType === "constant" ||
					metaType === "select" ||
					metaType === "where" ||
					metaType === "properties"
				) {
					return "relative my-1.5 rounded-md bg-blue-100 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
				} else {
					if (
						metaType === "column-item" ||
						metaType === "constant-value" ||
						metaType === "where-value"
					) {
						return "pl-0! pr-0! ml-2.5 border-y border-t-transparent";
					} else {
						return "pr-0";
					}
				}
			}}
			items={tree}
			rootItemId="root"
			expandedItems={expandedItemIds as any}
			onExpandedItemsChange={(expandedItems: any) =>
				setCollapsedItemIds(
					Object.keys(tree).filter((item) => !expandedItems.includes(item)),
				)
			}
			customItemView={customItemView}
			disableHover={true}
			canReorder={true}
			onDropFn={onDropTreeItem}
		/>
	);
};
