import type { CanonicalResource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type {
	ViewDefinition,
	ViewDefinitionConstant,
	ViewDefinitionSelect,
	ViewDefinitionSelectColumn,
	ViewDefinitionWhere,
} from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	type ItemInstance,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	type TreeInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import {
	ChevronDown,
	Funnel,
	GripVertical,
	Info,
	Pi,
	PlusIcon,
	ShieldCheck,
	TextQuote,
	TriangleAlert,
	X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce, useLocalStorage } from "../../hooks";
import { generateId } from "../../utils";
import type {
	FormTreeSelectItem,
	ViewDefinitionBuilderActions,
} from "../../webmcp/view-definition-context";
import { computeFhirPathContext, FhirPathInput } from "./fhirpath-input";
import { FhirPathLspProvider } from "./fhirpath-lsp-context";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import { ResourceTypeSelect } from "./resource-type-select";

// --- De-identification extension support ---

const DEIDENT_EXT_URL =
	"http://health-samurai.io/fhir/core/StructureDefinition/de-identification";

type DeIdentMethod =
	| "redact"
	| "keep"
	| "cryptoHash"
	| "dateshift"
	| "dateshiftSafeHarbor"
	| "encrypt"
	| "substitute"
	| "perturb"
	| "custom_function";

interface DeIdentConfig {
	method: DeIdentMethod;
	cryptoHashKey?: string;
	dateShiftKey?: string;
	encryptKey?: string;
	replaceWith?: string;
	span?: number | string;
	rangeType?: string;
	roundTo?: number | string;
	customFunction?: string;
	customArg?: string;
}

const DEIDENT_METHODS: {
	value: DeIdentMethod;
	label: string;
	description: string;
}[] = [
	{
		value: "redact",
		label: "Redact",
		description: "Remove the value entirely (returns NULL)",
	},
	{
		value: "cryptoHash",
		label: "Crypto Hash",
		description: "Replace with HMAC-SHA256 hash (one-way, deterministic)",
	},
	{
		value: "dateshift",
		label: "Date Shift",
		description:
			"Shift dates by a deterministic offset per resource (±1–50 days)",
	},
	{
		value: "dateshiftSafeHarbor",
		label: "Date Shift (Safe Harbor)",
		description:
			"Date shift that redacts values indicating age over 89 (HIPAA Safe Harbor)",
	},
	{
		value: "encrypt",
		label: "Encrypt",
		description: "AES-128 encrypt (reversible with key)",
	},
	{
		value: "substitute",
		label: "Substitute",
		description: "Replace with a fixed value",
	},
	{
		value: "perturb",
		label: "Perturb",
		description: "Add random noise to numeric values",
	},
	{
		value: "custom_function",
		label: "Custom Function",
		description: "Apply a custom PostgreSQL function",
	},
];

function parseDeIdentExtension(
	// biome-ignore lint/suspicious/noExplicitAny: Extension type lacks index signature for value[x] fields
	extensions: any[] | undefined,
): DeIdentConfig | undefined {
	if (!extensions) return undefined;
	const ext = extensions.find((e) => e.url === DEIDENT_EXT_URL);
	if (!ext?.extension) return undefined;

	const get = (url: string): unknown => {
		// biome-ignore lint/suspicious/noExplicitAny: extensions have dynamic value[x] fields
		const sub = ext.extension?.find((s: any) => s.url === url);
		if (!sub) return undefined;
		return (
			sub.valueCode ??
			sub.valueString ??
			sub.valueInteger ??
			sub.valueDecimal ??
			sub.valueBoolean ??
			undefined
		);
	};

	const method = get("method") as DeIdentMethod | undefined;
	if (!method) return undefined;

	return {
		method,
		cryptoHashKey: get("cryptoHashKey") as string | undefined,
		dateShiftKey: get("dateShiftKey") as string | undefined,
		encryptKey: get("encryptKey") as string | undefined,
		replaceWith: get("replaceWith") as string | undefined,
		span: get("span") as number | undefined,
		rangeType: get("rangeType") as string | undefined,
		roundTo: get("roundTo") as number | undefined,
		customFunction: get("custom_function") as string | undefined,
		customArg: get("custom_arg") as string | undefined,
	};
}

function buildDeIdentExtension(config: DeIdentConfig | undefined):
	| Array<{
			url: string;
			extension: Array<{ url: string; [key: string]: unknown }>;
	  }>
	| undefined {
	if (!config) return undefined;
	const subs: Array<{ url: string; [key: string]: unknown }> = [
		{ url: "method", valueCode: config.method },
	];

	if (config.method === "cryptoHash" && config.cryptoHashKey)
		subs.push({ url: "cryptoHashKey", valueString: config.cryptoHashKey });
	if (
		(config.method === "dateshift" ||
			config.method === "dateshiftSafeHarbor") &&
		config.dateShiftKey
	)
		subs.push({ url: "dateShiftKey", valueString: config.dateShiftKey });
	if (config.method === "encrypt" && config.encryptKey)
		subs.push({ url: "encryptKey", valueString: config.encryptKey });
	if (config.method === "substitute" && config.replaceWith)
		subs.push({ url: "replaceWith", valueString: config.replaceWith });
	if (config.method === "perturb") {
		if (config.span != null) {
			const n = Number(config.span);
			subs.push(
				Number.isNaN(n)
					? { url: "span", valueString: String(config.span) }
					: { url: "span", valueDecimal: n },
			);
		}
		if (config.rangeType)
			subs.push({ url: "rangeType", valueCode: config.rangeType });
		if (config.roundTo != null) {
			const n = Number(config.roundTo);
			subs.push(
				Number.isNaN(n)
					? { url: "roundTo", valueString: String(config.roundTo) }
					: { url: "roundTo", valueInteger: n },
			);
		}
	}
	if (config.method === "custom_function") {
		if (config.customFunction)
			subs.push({ url: "custom_function", valueString: config.customFunction });
		if (config.customArg)
			subs.push({ url: "custom_arg", valueString: config.customArg });
	}

	return [{ url: DEIDENT_EXT_URL, extension: subs }];
}

// --- End de-identification ---

type ItemMeta = {
	type:
		| "select-column"
		| "select-forEach"
		| "select-forEachOrNull"
		| "select-unionAll"
		| "column-item"
		| "column-add"
		| "select-add-nested"
		| "constant-value"
		| "where-value"
		| "properties"
		| "name"
		| "status"
		| "resource"
		| "constant"
		| "constant-add"
		| "where"
		| "where-add"
		| "select"
		| "select-add"
		| "column"
		| "resource";
	columnData?: ColumnItem;
	selectData?: SelectItemInternal;
	selectItemId?: string;
	parentId?: string;
	lastNode?: boolean;
	constantData?: ConstantItem;
	whereData?: WhereItem;
};

type ConstantItem = ViewDefinitionConstant & {
	nodeId: string;
};

type WhereItem = ViewDefinitionWhere & {
	nodeId: string;
};

type ColumnItem = ViewDefinitionSelectColumn & {
	nodeId: string;
};

type SelectItemInternal = ViewDefinitionSelect & {
	nodeId: string;
	type: "column" | "forEach" | "forEachOrNull" | "unionAll";
	column?: ColumnItem[];
	expression?: string;
	children?: SelectItemInternal[];
};

/** Reorder items that have a `nodeId` field to match the given ID order. */
function reorderByNodeIds<T extends { nodeId: string }>(
	items: T[],
	orderedIds: string[],
): T[] {
	const reordered: T[] = [];
	for (const id of orderedIds) {
		const found = items.find((i) => i.nodeId === id);
		if (found) reordered.push(found);
	}
	return reordered;
}

/** Recursively find and update reordered children within nested select items. */
function findAndReorderSelectItems(
	items: SelectItemInternal[],
	targetNodeId: string,
	newChildren: string[],
): { updated: boolean; items: SelectItemInternal[] } {
	let wasUpdated = false;
	const updatedItems = items.map((item) =>
		processSelectItemForReorder(item, targetNodeId, newChildren, (flag) => {
			wasUpdated = flag;
		}),
	);
	return { updated: wasUpdated, items: updatedItems };
}

function processSelectItemForReorder(
	item: SelectItemInternal,
	targetNodeId: string,
	newChildren: string[],
	setUpdated: (v: boolean) => void,
): SelectItemInternal {
	if (item.nodeId === targetNodeId) {
		if (item.type === "column" && item.column) {
			const reorderedColumnIds = newChildren.filter(
				(id) => !id.endsWith("_add_column"),
			);
			const reorderedColumns = reorderByNodeIds(
				item.column,
				reorderedColumnIds,
			);
			if (reorderedColumns.length === item.column.length) {
				setUpdated(true);
				return { ...item, column: reorderedColumns };
			}
		} else if (
			(item.type === "forEach" ||
				item.type === "forEachOrNull" ||
				item.type === "unionAll") &&
			item.children
		) {
			const reorderedChildIds = newChildren.filter(
				(id) => !id.endsWith("_add_select"),
			);
			const reorderedChildren = reorderByNodeIds(
				item.children,
				reorderedChildIds,
			);
			if (reorderedChildren.length === item.children.length) {
				setUpdated(true);
				return { ...item, children: reorderedChildren };
			}
		}
	} else if (item.children && item.children.length > 0) {
		const result = findAndReorderSelectItems(
			item.children,
			targetNodeId,
			newChildren,
		);
		if (result.updated) {
			setUpdated(true);
			return { ...item, children: result.items };
		}
	}
	return item;
}

// Helper functions

const parseColumn = (id: string, column: ViewDefinitionSelectColumn[]) => {
	return {
		nodeId: id,
		type: "column" as const,
		column: column.map((c, idx) => ({
			nodeId: `${id}-col-${idx}-${generateId()}`,
			name: c.name || "",
			path: c.path || "",
			extension: c.extension,
		})),
	};
};

const parseForEach = (
	id: string,
	forEach: string,
	select: ViewDefinitionSelect[] | undefined,
) => {
	return {
		nodeId: id,
		type: "forEach" as const,
		expression: forEach,
		children: select ? parseSelectItems(select, `${id}-`) : [],
	};
};

const parseForEachOrNull = (
	id: string,
	forEachOrNull: string,
	select: ViewDefinitionSelect[] | undefined,
) => {
	return {
		nodeId: id,
		type: "forEachOrNull" as const,
		expression: forEachOrNull,
		children: select ? parseSelectItems(select, `${id}-`) : [],
	};
};

const parseUnionAll = (
	id: string,
	unionAll: ViewDefinitionSelect[] | undefined,
) => {
	return {
		nodeId: id,
		type: "unionAll" as const,
		children: unionAll ? parseSelectItems(unionAll, `${id}-`) : [],
	};
};

const parseSelectItems = (
	items: ViewDefinitionSelect[],
	parentId = "",
): SelectItemInternal[] => {
	return items.flatMap((item, index) => {
		const id = `${parentId}select-${index}-${generateId()}`;
		if (item.column) return parseColumn(id, item.column);
		else if (item.forEach) return parseForEach(id, item.forEach, item.select);
		else if (item.forEachOrNull)
			return parseForEachOrNull(id, item.forEachOrNull, item.select);
		else if (item.unionAll) return parseUnionAll(id, item.unionAll);
		else return [];
	});
};

const buildColumn = (columns: ColumnItem[]) => {
	return {
		column: columns.map((col) => {
			const result: ViewDefinitionSelectColumn = {
				name: col.name,
				path: col.path,
			};
			if (col.extension && col.extension.length > 0) {
				result.extension = col.extension;
			}
			return result;
		}),
	};
};

const buildForEach = ({ expression, children }: SelectItemInternal) => {
	const result: ViewDefinitionSelect = {
		forEach: expression || "",
	};
	if (children && children.length > 0) {
		result.select = buildSelectArray(children);
	}
	return result;
};

const buildForEachOrNull = ({ expression, children }: SelectItemInternal) => {
	const result: ViewDefinitionSelect = {
		forEachOrNull: expression || "",
	};
	if (children && children.length > 0) {
		result.select = buildSelectArray(children);
	}
	return result;
};

const buildUnionAll = ({ children }: SelectItemInternal) => {
	return {
		unionAll: children ? buildSelectArray(children) : [],
	};
};

/**
 * Build a map from FHIR expression path prefixes to column nodeIds.
 * E.g., "ViewDefinition.select[0].column[1]" → nodeId of the 2nd column in the 1st select.
 * Also maps select-level paths for forEach/forEachOrNull items.
 */
function buildExpressionToNodeIdMap(
	items: SelectItemInternal[],
	parentPath = "ViewDefinition",
): Map<string, string> {
	const map = new Map<string, string>();
	let selectIdx = 0;
	for (const item of items) {
		const selectPath = `${parentPath}.select[${selectIdx}]`;
		map.set(selectPath, item.nodeId);
		if (item.type === "column" && item.column) {
			for (let colIdx = 0; colIdx < item.column.length; colIdx++) {
				const col = item.column[colIdx];
				if (!col) continue;
				const colPath = `${selectPath}.column[${colIdx}]`;
				map.set(colPath, col.nodeId);
			}
		} else if (item.children) {
			const childMap = buildExpressionToNodeIdMap(item.children, selectPath);
			for (const [k, v] of childMap) map.set(k, v);
		}
		selectIdx++;
	}
	return map;
}

/**
 * Find the nodeId for a FHIR expression by matching the longest prefix.
 * E.g., "ViewDefinition.select[0].column[1].extension[0]" matches column[1].
 */
function resolveExpressionToNodeId(
	expr: string,
	exprMap: Map<string, string>,
): string | undefined {
	// Try exact match first, then progressively shorter prefixes
	let path = expr;
	while (path.length > 0) {
		const nodeId = exprMap.get(path);
		if (nodeId) return nodeId;
		// Remove last segment (e.g., ".extension[0]" or ".column[1]")
		const lastDot = path.lastIndexOf(".");
		const lastBracket = path.lastIndexOf("[");
		const cutAt = Math.max(lastDot, lastBracket);
		if (cutAt <= 0) break;
		path = path.substring(0, cutAt);
	}
	return undefined;
}

type ErrorTarget = "extension" | "path" | "name" | "column";

function isEmpty(v: unknown): boolean {
	return v === undefined || v === null || v === "";
}

function isMissingDeidentParam(config: DeIdentConfig | undefined): boolean {
	if (!config) return false;
	switch (config.method) {
		case "cryptoHash":
			return isEmpty(config.cryptoHashKey);
		case "dateshift":
		case "dateshiftSafeHarbor":
			return isEmpty(config.dateShiftKey);
		case "encrypt":
			return isEmpty(config.encryptKey);
		case "substitute":
			return isEmpty(config.replaceWith);
		case "custom_function":
			return isEmpty(config.customFunction);
		default:
			return false;
	}
}

function computeFieldErrors(
	issues: Array<{ expression?: string[] }> | undefined,
	paramPrefix: RegExp,
	constants: ConstantItem[],
	whereConditions: WhereItem[],
): Set<string> {
	if (!issues) return new Set();
	const result = new Set<string>();
	for (const issue of issues) {
		for (let expr of issue.expression ?? []) {
			expr = expr.replace(paramPrefix, "ViewDefinition.");
			const topMatch = expr.match(/^ViewDefinition\.(name|status|resource)$/);
			if (topMatch?.[1]) {
				result.add(topMatch[1]);
				continue;
			}
			const constMatch = expr.match(/^ViewDefinition\.constant\[(\d+)\]/);
			const constItem =
				constMatch?.[1] != null ? constants[Number(constMatch[1])] : undefined;
			if (constItem) {
				const suffix = expr.endsWith(".name")
					? ":name"
					: expr.endsWith(".value")
						? ":value"
						: "";
				result.add(constItem.nodeId + suffix);
				continue;
			}
			const whereMatch = expr.match(/^ViewDefinition\.where\[(\d+)\]/);
			const whereItem =
				whereMatch?.[1] != null
					? whereConditions[Number(whereMatch[1])]
					: undefined;
			if (whereItem) {
				result.add(whereItem.nodeId);
			}
		}
	}
	return result;
}

function classifyErrorTarget(expr: string): ErrorTarget {
	if (expr.includes(".extension")) return "extension";
	if (expr.endsWith(".path")) return "path";
	if (expr.endsWith(".name")) return "name";
	return "column";
}

const buildSelectArray = (
	items: SelectItemInternal[],
): ViewDefinitionSelect[] => {
	return items.flatMap((item) => {
		if (item.type === "column" && item.column) return buildColumn(item.column);
		else if (item.type === "forEach") return buildForEach(item);
		else if (item.type === "forEachOrNull") return buildForEachOrNull(item);
		else if (item.type === "unionAll") return buildUnionAll(item);
		else return [];
	});
};

const findPath = (
	items: SelectItemInternal[],
	targetId: string | undefined,
	path: string[] = [],
): string[] | null => {
	for (const item of items) {
		if (item.nodeId === targetId) {
			return path;
		}
		if (item.children) {
			const result = findPath(item.children, targetId, [...path, item.nodeId]);
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
	}, 500);

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
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		/>
	);
};

function ValidatedInput({
	value,
	placeholder,
	validate,
	errorMessage,
	onChange,
}: {
	value: string;
	placeholder: string;
	validate: (v: string) => boolean;
	errorMessage: string;
	onChange: (v: string) => void;
}) {
	const [localValue, setLocalValue] = useState(value);
	const lastSent = React.useRef(value);

	useEffect(() => {
		if (value !== lastSent.current) {
			setLocalValue(value);
			lastSent.current = value;
		}
	}, [value]);

	const isInvalid = localValue !== "" && !validate(localValue);
	return (
		<div>
			<Input
				className={`h-8 ${isInvalid ? "border-border-error! focus-visible:border-border-error!" : ""}`}
				placeholder={placeholder}
				value={localValue}
				onChange={(e) => {
					setLocalValue(e.target.value);
					lastSent.current = e.target.value;
					onChange(e.target.value);
				}}
			/>
			{isInvalid && (
				<span className="text-xs text-text-error-primary flex items-center gap-1 pt-2">
					<TriangleAlert size={12} className="shrink-0" />
					{errorMessage}
				</span>
			)}
		</div>
	);
}

function DeIdentMethodParams({
	config,
	update,
}: {
	config: DeIdentConfig | undefined;
	update: (patch: Partial<DeIdentConfig>) => void;
}) {
	const method = config?.method;
	if (!method) return null;

	switch (method) {
		case "cryptoHash":
			return (
				<Input
					className={`h-8 ${isEmpty(config?.cryptoHashKey) ? "border-border-error! focus-visible:border-border-error!" : ""}`}
					placeholder="HMAC Key"
					value={config?.cryptoHashKey || ""}
					onChange={(e) => update({ cryptoHashKey: e.target.value })}
				/>
			);
		case "dateshift":
		case "dateshiftSafeHarbor":
			return (
				<>
					<Input
						className={`h-8 ${isEmpty(config?.dateShiftKey) ? "border-border-error! focus-visible:border-border-error!" : ""}`}
						placeholder="Date Shift Key"
						value={config?.dateShiftKey || ""}
						onChange={(e) => update({ dateShiftKey: e.target.value })}
					/>
					{method === "dateshiftSafeHarbor" && (
						<span className="text-xs text-text-tertiary flex items-center gap-1">
							<Info size={12} className="shrink-0" />
							Use on birth date fields only
						</span>
					)}
				</>
			);
		case "encrypt":
			return (
				<div>
					<Input
						className={`h-8 ${isEmpty(config?.encryptKey) || (config?.encryptKey && !/^([0-9a-fA-F]{2}){4,16}$/.test(config.encryptKey)) ? "border-border-error! focus-visible:border-border-error!" : ""}`}
						placeholder="Hex key (8-32 hex chars)"
						value={config?.encryptKey || ""}
						onChange={(e) => update({ encryptKey: e.target.value })}
					/>
					{config?.encryptKey &&
						!/^([0-9a-fA-F]{2}){4,16}$/.test(config.encryptKey) && (
							<span className="text-xs text-text-error-primary flex items-center gap-1 pt-2">
								<TriangleAlert size={12} className="shrink-0" />
								8-32 hex characters, even count (0-9, a-f)
							</span>
						)}
				</div>
			);
		case "substitute":
			return (
				<Input
					className={`h-8 ${isEmpty(config?.replaceWith) ? "border-border-error! focus-visible:border-border-error!" : ""}`}
					placeholder="Replace with"
					value={config?.replaceWith || ""}
					onChange={(e) => update({ replaceWith: e.target.value })}
				/>
			);
		case "perturb":
			return (
				<div className="flex flex-col gap-2">
					<ValidatedInput
						value={config?.span != null ? String(config.span) : ""}
						placeholder="Span (e.g. 10)"
						validate={(v) => !Number.isNaN(Number(v))}
						errorMessage="Must be a number"
						onChange={(v) =>
							update({
								span: v || undefined,
							} as Partial<DeIdentConfig>)
						}
					/>
					<Select
						value={config?.rangeType || "fixed"}
						onValueChange={(v) => update({ rangeType: v })}
					>
						<SelectTrigger className="h-8">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="fixed">Fixed</SelectItem>
							<SelectItem value="proportional">Proportional</SelectItem>
						</SelectContent>
					</Select>
					<ValidatedInput
						value={config?.roundTo != null ? String(config.roundTo) : ""}
						placeholder="Round to (decimals)"
						validate={(v) => !Number.isNaN(Number(v))}
						errorMessage="Must be a number"
						onChange={(v) =>
							update({
								roundTo: v || undefined,
							} as Partial<DeIdentConfig>)
						}
					/>
				</div>
			);
		case "custom_function":
			return (
				<div className="flex flex-col gap-2">
					<ValidatedInput
						value={config?.customFunction || ""}
						placeholder="Function name"
						validate={(v) => /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(v)}
						errorMessage="Letters, digits, underscores, dots only"
						onChange={(v) => update({ customFunction: v })}
					/>
					<Input
						className="h-8"
						placeholder="Argument (optional)"
						value={config?.customArg || ""}
						onChange={(e) => update({ customArg: e.target.value })}
					/>
				</div>
			);
		default:
			return null;
	}
}

// --- De-identification popover component ---

function DeIdentPopover({
	config,
	onChange,
	hasError,
	registerOpen,
}: {
	config: DeIdentConfig | undefined;
	onChange: (config: DeIdentConfig | undefined) => void;
	hasError?: boolean;
	registerOpen?: (openFn: () => void) => void;
}) {
	const [open, setOpen] = React.useState(false);
	React.useEffect(() => {
		registerOpen?.(() => setOpen(true));
	}, [registerOpen]);
	const method = config?.method;

	const update = (patch: Partial<DeIdentConfig>) => {
		if (!config) return;
		onChange({ ...config, ...patch });
	};

	const showError = hasError || isMissingDeidentParam(config);

	const methodLabel = config
		? (DEIDENT_METHODS.find((m) => m.value === config.method)?.label ??
			config.method)
		: undefined;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							variant="link"
							size="small"
							className={`shrink-0 ${showError ? "text-text-error-primary" : config ? "text-text-info-primary" : "group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"}`}
							asChild
						>
							<span>
								<ShieldCheck size={14} />
							</span>
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>
					{methodLabel
						? `De-identification: ${methodLabel}`
						: "De-identification: none"}
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				className="w-72 p-3 flex flex-col gap-2"
				align="end"
				sideOffset={4}
				alignOffset={16}
				onClick={(e) => e.stopPropagation()}
				onMouseDown={(e) => e.stopPropagation()}
			>
				<span className="text-xs font-medium text-text-secondary">
					De-identification
				</span>
				<Select
					value={method || "none"}
					onValueChange={(v) => {
						if (v === "none") {
							onChange(undefined);
						} else {
							const m = v as DeIdentMethod;
							onChange(
								m === "perturb"
									? { method: m, rangeType: "fixed", roundTo: 0 }
									: { method: m },
							);
						}
					}}
				>
					<SelectTrigger className="h-8">
						<SelectValue placeholder="None" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">None</SelectItem>
						{DEIDENT_METHODS.map((m) => (
							<SelectItem key={m.value} value={m.value} title={m.description}>
								{m.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{method && (
					<span className="text-xs text-text-tertiary">
						{DEIDENT_METHODS.find((m) => m.value === method)?.description}
					</span>
				)}

				<DeIdentMethodParams config={config} update={update} />
			</PopoverContent>
		</Popover>
	);
}

export const FormTabContent = ({
	actionsRef,
}: {
	actionsRef: React.RefObject<ViewDefinitionBuilderActions | null>;
}) => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinition = viewDefinitionContext.viewDefinition;
	const { viewDefinitionResourceType, setViewDefinitionResourceType } =
		React.useContext(ViewDefinitionResourceTypeContext);

	const [constants, setConstants] = useState<ConstantItem[]>([]);
	const [whereConditions, setWhereConditions] = useState<WhereItem[]>([]);
	const [selectItems, setSelectItems] = useState<SelectItemInternal[]>([]);
	const [collapsedItemIds, setCollapsedItemIds] = useLocalStorage<string[]>({
		key: `viewDefinition-form-collapsed-${viewDefinition?.id || "default"}`,
		defaultValue: ["_properties"],
	});

	const paramPrefix = /^Parameters\.parameter\[\d+\]\.resource\./;

	const fieldErrors = useMemo(
		() =>
			computeFieldErrors(
				viewDefinitionContext.runError?.issue,
				paramPrefix,
				constants,
				whereConditions,
			),
		[viewDefinitionContext.runError, constants, whereConditions],
	);

	// Compute per-column error targets from OperationOutcome issues
	const columnErrors = useMemo(() => {
		const issues = viewDefinitionContext.runError?.issue;
		if (!issues || selectItems.length === 0)
			return new Map<string, Set<ErrorTarget>>();
		const exprMap = buildExpressionToNodeIdMap(selectItems);
		const result = new Map<string, Set<ErrorTarget>>();
		for (const issue of issues) {
			for (let expr of issue.expression ?? []) {
				expr = expr.replace(paramPrefix, "ViewDefinition.");
				const nodeId = resolveExpressionToNodeId(expr, exprMap);
				if (!nodeId) continue;
				if (!result.has(nodeId)) result.set(nodeId, new Set());
				(result.get(nodeId) ?? new Set()).add(classifyErrorTarget(expr));
			}
		}
		return result;
	}, [viewDefinitionContext.runError, selectItems]);

	// Refs for programmatic focus: popover openers keyed by nodeId
	const deidentPopoverRefs = React.useRef<Map<string, () => void>>(new Map());

	// Set issueClickRef for form builder — scroll, focus input or open popover
	viewDefinitionContext.issueClickRef.current = (issue) => {
		let expr = issue.expression?.[0];
		if (!expr) return;

		// Strip Parameters wrapper prefix from $run responses
		const paramPrefix = /^Parameters\.parameter\[\d+\]\.resource\./;
		expr = expr.replace(paramPrefix, "ViewDefinition.");

		// Handle top-level ViewDefinition fields (name, status, resource)
		const topLevelField = expr.match(
			/^ViewDefinition\.(name|status|resource)$/,
		)?.[1];
		if (topLevelField) {
			const input = document.querySelector<HTMLInputElement>(
				`[data-field="${topLevelField}"] input`,
			);
			if (input) {
				input.scrollIntoView({ behavior: "smooth", block: "center" });
				setTimeout(() => input.focus(), 300);
			}
			return;
		}

		// Handle constants: ViewDefinition.constant[N]
		const constClickMatch = expr.match(/^ViewDefinition\.constant\[(\d+)\]/);
		const constClickItem =
			constClickMatch?.[1] != null
				? constants[Number(constClickMatch[1])]
				: undefined;
		if (constClickItem) {
			const el = document.querySelector(
				`[data-node-id="${constClickItem.nodeId}"]`,
			);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				setTimeout(() => {
					// Focus second input (value) if the error is on value, else first (name)
					const inputs = el.querySelectorAll<HTMLInputElement>("input");
					const isValueErr = expr.endsWith(".value");
					(isValueErr ? inputs[1] : inputs[0])?.focus();
				}, 300);
			}
			return;
		}

		// Handle where conditions: ViewDefinition.where[N]
		const whereClickMatch = expr.match(/^ViewDefinition\.where\[(\d+)\]/);
		const whereClickItem =
			whereClickMatch?.[1] != null
				? whereConditions[Number(whereClickMatch[1])]
				: undefined;
		if (whereClickItem) {
			const el = document.querySelector(
				`[data-node-id="${whereClickItem.nodeId}"]`,
			);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				setTimeout(() => {
					document.getElementById(`fhirpath-${whereClickItem.nodeId}`)?.focus();
				}, 300);
			}
			return;
		}

		// Handle select/column paths
		const exprMap = buildExpressionToNodeIdMap(selectItems);
		const nodeId = resolveExpressionToNodeId(expr, exprMap);
		if (!nodeId) return;
		const target = classifyErrorTarget(expr);
		const el = document.querySelector(`[data-node-id="${nodeId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
			setTimeout(() => {
				if (target === "name") {
					const input = el.querySelector<HTMLInputElement>("input");
					input?.focus();
				} else if (target === "path") {
					const pathEl = document.getElementById(`fhirpath-${nodeId}`);
					pathEl?.focus();
				} else if (target === "extension") {
					deidentPopoverRefs.current.get(nodeId)?.();
				}
			}, 300);
		}
	};

	// Initialize state from viewDefinition - only on initial load or when ID changes
	// Use a special marker to distinguish "not initialized" from "initialized with no id"
	const [lastViewDefId, setLastViewDefId] = useState<string | null | undefined>(
		undefined,
	);

	useEffect(() => {
		// undefined means not yet initialized, null means initialized with no id
		const currentId = viewDefinition?.id ?? null;
		const shouldInitialize =
			viewDefinition &&
			(lastViewDefId === undefined || currentId !== lastViewDefId);

		if (!shouldInitialize) return;

		setLastViewDefId(currentId);

		if (
			viewDefinition?.constant &&
			Array.isArray(viewDefinition.constant) &&
			viewDefinition.constant.length > 0
		) {
			const constantsWithIds = viewDefinition.constant.map(
				(c, index: number) => ({
					nodeId: `constant-${index}-${generateId()}`,
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
			const whereWithIds = viewDefinition.where.map((w, index: number) => ({
				nodeId: `where-${index}-${generateId()}`,
				path: w.path || "",
			}));
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
	}, [viewDefinition, lastViewDefId]);

	// Function to update ViewDefinition with new constants and where conditions
	const updateViewDefinition = useCallback(
		(
			updatedConstants?: ConstantItem[],
			updatedWhere?: WhereItem[],
			updatedFields?: Partial<ViewDefinition>,
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

				const updatedViewDef: ViewDefinition = {
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

				updatedViewDef.select = selectArray;

				viewDefinitionContext.setViewDefinition(updatedViewDef);
				viewDefinitionContext.setIsDirty(true);
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
	const addConstant = (name?: string, valueString?: string) => {
		const newConstant = {
			nodeId: `constant-${constants.length}-${generateId()}`,
			name: name ?? "",
			valueString: valueString ?? "",
		};
		const updatedConstants = [...constants, newConstant];
		setConstants(updatedConstants);

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => id !== newConstant.nodeId && id !== "_constant",
		);
		setCollapsedItemIds(newCollapsedIds);

		updateViewDefinition(updatedConstants);
		return newConstant.nodeId;
	};

	// Function to update a specific constant
	const updateConstant = (
		id: string,
		field: "name" | "valueString",
		value: string,
	) => {
		const updatedConstants = constants.map((c) =>
			c.nodeId === id ? { ...c, [field]: value } : c,
		);
		setConstants(updatedConstants);
		updateViewDefinition(updatedConstants);
	};

	// Function to remove a constant
	const removeConstant = (id: string) => {
		const updatedConstants = constants.filter((c) => c.nodeId !== id);
		setConstants(updatedConstants);
		updateViewDefinition(updatedConstants);
	};

	// Function to add a new where condition
	const addWhereCondition = (path?: string) => {
		const newWhere = {
			nodeId: `where-${whereConditions.length}-${generateId()}`,
			path: path ?? "",
		};
		const updatedWhere = [...whereConditions, newWhere];
		setWhereConditions(updatedWhere);

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => id !== newWhere.nodeId && id !== "_where",
		);
		setCollapsedItemIds(newCollapsedIds);

		updateViewDefinition(undefined, updatedWhere);
		return newWhere.nodeId;
	};

	// Function to update a specific where condition
	const updateWhereCondition = (id: string, path: string) => {
		const updatedWhere = whereConditions.map((w) =>
			w.nodeId === id ? { ...w, path } : w,
		);
		setWhereConditions(updatedWhere);
		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to remove a where condition
	const removeWhereCondition = (id: string) => {
		const updatedWhere = whereConditions.filter((w) => w.nodeId !== id);
		setWhereConditions(updatedWhere);
		updateViewDefinition(undefined, updatedWhere);
	};

	// Function to update resource type
	const updateResource = (resource: string) => {
		setViewDefinitionResourceType(resource);
		updateViewDefinition(undefined, undefined, { resource });
	};

	// Function to update name field
	const updateName = (name: string) => {
		updateViewDefinition(undefined, undefined, { name });
	};

	// Function to update status field
	const updateStatus = (status: CanonicalResource["status"]) => {
		updateViewDefinition(undefined, undefined, { status });
	};

	// Function to add a new select item
	const addSelectItem = (
		type: "column" | "forEach" | "forEachOrNull" | "unionAll",
		parentPath?: string[],
	) => {
		const newItem: SelectItemInternal = {
			nodeId: `${type}-${Date.now()}-${generateId()}`,
			type,
		};

		if (type === "column") {
			newItem.column = [
				{
					nodeId: `col-${Date.now()}-${generateId()}`,
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

		const idsToRemove = [newItem.nodeId, "_select"];

		if (parentPath) {
			idsToRemove.push(...parentPath);
		}

		if (type === "column" && newItem.column) {
			newItem.column.forEach((col: ColumnItem) => {
				idsToRemove.push(col.nodeId);
			});
			idsToRemove.push(`${newItem.nodeId}_add_column`);
		} else if (
			type === "forEach" ||
			type === "forEachOrNull" ||
			type === "unionAll"
		) {
			idsToRemove.push(`${newItem.nodeId}_add_select`);
		}

		const newCollapsedIds = collapsedItemIds.filter(
			(id) => !idsToRemove.includes(id),
		);

		setCollapsedItemIds(newCollapsedIds);

		if (parentPath) {
			const updatedItems = JSON.parse(JSON.stringify(selectItems));
			let target = updatedItems;
			for (const id of parentPath) {
				const item = target.find((i: SelectItemInternal) => i.nodeId === id);
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
		return newItem.nodeId;
	};

	// Function to add a column to a column-type select item
	const addColumnToSelectItem = (
		selectItemId: string,
		name?: string,
		path?: string,
	) => {
		const newColumnId = `col-${Date.now()}-${generateId()}`;

		const parentPath = findPath(selectItems, selectItemId);

		const addColumnRecursive = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
			return items.map((item) => {
				if (item.nodeId === selectItemId) {
					return {
						...item,
						column: [
							...(item.column || []),
							{
								nodeId: newColumnId,
								name: name ?? "",
								path: path ?? "",
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
		return newColumnId;
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
				if (item.nodeId === selectItemId && item.column) {
					return {
						...item,
						column: item.column.map((col: ColumnItem) =>
							col.nodeId === columnId ? { ...col, [field]: value } : col,
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

	// Function to update de-identification config on a column
	const updateColumnDeIdent = (
		selectItemId: string,
		columnId: string,
		deIdentConfig: DeIdentConfig | undefined,
	) => {
		const updateColumns = (
			items: SelectItemInternal[],
		): SelectItemInternal[] => {
			return items.map((item) => {
				if (item.nodeId === selectItemId && item.column) {
					return {
						...item,
						column: item.column.map((col: ColumnItem) => {
							if (col.nodeId !== columnId) return col;
							const otherExts = (col.extension || []).filter(
								(e) => e.url !== DEIDENT_EXT_URL,
							);
							const deIdentExt = buildDeIdentExtension(deIdentConfig);
							const newExts = deIdentExt
								? [...otherExts, ...deIdentExt]
								: otherExts;
							return {
								...col,
								extension: newExts.length > 0 ? newExts : undefined,
							};
						}),
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
					item.nodeId === selectItemId &&
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
				if (item.nodeId === selectItemId && item.column) {
					return {
						...item,
						column: item.column.filter(
							(col: ColumnItem) => col.nodeId !== columnId,
						),
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
				.filter((item) => item.nodeId !== itemId)
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
	const tree: Record<string, TreeViewItem<ItemMeta>> = useMemo(() => {
		const constantChildren =
			constants.length > 0 ? constants.map((c) => c.nodeId) : [];
		constantChildren.push("_constant_add");

		const whereChildren =
			whereConditions.length > 0 ? whereConditions.map((w) => w.nodeId) : [];
		whereChildren.push("_where_add");

		const treeStructure: Record<string, TreeViewItem<ItemMeta>> = {};

		// Build tree for nested select items
		const buildSelectTree = (items: SelectItemInternal[]): string[] => {
			const children: string[] = [];

			items.forEach((item) => {
				children.push(item.nodeId);

				const currentItem: TreeViewItem<ItemMeta> = {
					name: item.nodeId,
					meta: {
						type: `select-${item.type}`,
						selectData: item,
					},
					children: [],
				};

				treeStructure[item.nodeId] = currentItem;

				if (item.type === "column" && item.column) {
					const columnChildren: string[] = [];
					item.column.forEach((col: ColumnItem) => {
						columnChildren.push(col.nodeId);
						treeStructure[col.nodeId] = {
							name: col.nodeId,
							meta: {
								type: "column-item",
								columnData: col,
								selectItemId: item.nodeId,
							},
						};
					});
					columnChildren.push(`${item.nodeId}_add_column`);
					treeStructure[`${item.nodeId}_add_column`] = {
						name: `${item.nodeId}_add_column`,
						meta: {
							type: "column-add",
							selectItemId: item.nodeId,
						},
					};
					currentItem.children = columnChildren;
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

					nodeChildren.push(`${item.nodeId}_add_select`);
					treeStructure[`${item.nodeId}_add_select`] = {
						name: `${item.nodeId}_add_select`,
						meta: {
							type: "select-add-nested",
							parentId: item.nodeId,
						},
					};

					currentItem.children = nodeChildren;
				}
			});

			return children;
		};

		const newTreeStructure: Record<string, TreeViewItem<ItemMeta>> = {
			root: {
				name: "root",
				children: ["_properties", "_constant", "_where", "_select"],
			},
			_properties: {
				name: "_properties",
				meta: {
					type: "properties",
				},
				children: ["_resource", "_status", "_name"],
			},
			_resource: {
				name: "_resource",
				meta: {
					type: "resource",
				},
			},
			_name: {
				name: "_name",
				meta: {
					type: "name",
				},
			},
			_status: {
				name: "_status",
				meta: {
					type: "status",
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
		};

		Object.assign(treeStructure, newTreeStructure);

		constants.forEach((constant, index) => {
			treeStructure[constant.nodeId] = {
				name: constant.nodeId,
				meta: {
					type: "constant-value",
					lastNode: index === constants.length - 1,
					constantData: constant,
				},
			};
		});

		whereConditions.forEach((whereCondition, index) => {
			treeStructure[whereCondition.nodeId] = {
				name: whereCondition.nodeId,
				meta: {
					type: "where-value",
					lastNode: index === whereConditions.length - 1,
					whereData: whereCondition,
				},
			};
		});

		return treeStructure;
	}, [constants, whereConditions, selectItems]);

	// Compute expanded items from collapsed items
	const expandedItems = useMemo(() => {
		const allItemIds = Object.keys(tree).filter((id) => id !== "root");
		return allItemIds.filter((id) => !collapsedItemIds.includes(id));
	}, [tree, collapsedItemIds]);

	const onExpandedItemsChange = useCallback(
		(items: string[]) => {
			const allItemIds = Object.keys(tree).filter((id) => id !== "root");
			const newCollapsedIds = allItemIds.filter((id) => !items.includes(id));
			setCollapsedItemIds(newCollapsedIds);
		},
		[tree, setCollapsedItemIds],
	);

	const onDropTreeItem = (
		_tree: TreeInstance<TreeViewItem<ItemMeta>>,
		item: ItemInstance<TreeViewItem<ItemMeta>>,
		newChildren: string[],
	) => {
		item.getItemData().children = newChildren;

		const itemId = item.getId();

		// Handle reordering of constants
		if (itemId === "_constant") {
			const reorderedConstants = reorderByNodeIds(
				constants,
				newChildren.filter((id) => id !== "_constant_add"),
			);
			if (reorderedConstants.length === constants.length) {
				setConstants(reorderedConstants);
				updateViewDefinition(reorderedConstants);
			}
		}

		// Handle reordering of where conditions
		else if (itemId === "_where") {
			const reorderedWhere = reorderByNodeIds(
				whereConditions,
				newChildren.filter((id) => id !== "_where_add"),
			);
			if (reorderedWhere.length === whereConditions.length) {
				setWhereConditions(reorderedWhere);
				updateViewDefinition(undefined, reorderedWhere);
			}
		}

		// Handle reordering of top-level select items
		else if (itemId === "_select") {
			const reorderedSelect = reorderByNodeIds(
				selectItems,
				newChildren.filter((id) => id !== "_select_add"),
			);
			if (reorderedSelect.length === selectItems.length) {
				setSelectItems(reorderedSelect);
				updateViewDefinition(undefined, undefined, undefined, reorderedSelect);
			}
		}

		// Handle reordering within a select item (columns or nested selects)
		else {
			const result = findAndReorderSelectItems(
				selectItems,
				itemId,
				newChildren,
			);
			if (result.updated) {
				setSelectItems(result.items);
				updateViewDefinition(undefined, undefined, undefined, result.items);
			}
		}
	};

	const labelView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const metaType = item.getItemData()?.meta?.type;
		const selectData = item.getItemData()?.meta?.selectData;
		const isFolder = item.isFolder();
		let additionalClass = "";
		let label: string | undefined = metaType;

		if (metaType === "column") {
			additionalClass = "text-text-info-primary bg-bg-info-primary";
		} else if (metaType?.startsWith("select-")) {
			if (selectData?.type === "column") {
				label = "column";
				additionalClass = "text-text-info-primary bg-bg-info-primary";
			} else if (selectData?.type === "forEach") {
				label = "forEach";
				additionalClass = "text-text-info-primary bg-bg-info-primary";
			} else if (selectData?.type === "forEachOrNull") {
				label = "forEachOrNull";
				additionalClass = "text-text-info-primary bg-bg-info-primary";
			} else if (selectData?.type === "unionAll") {
				label = "unionAll";
				additionalClass = "text-text-warning-primary bg-bg-warning-primary";
			}
		} else if (
			metaType === "constant" ||
			metaType === "select" ||
			metaType === "where" ||
			metaType === "properties"
		) {
			additionalClass = "text-text-info-primary px-1!";
		} else if (
			metaType === "resource" ||
			metaType === "name" ||
			metaType === "status"
		)
			additionalClass = "text-text-info-primary bg-bg-info-primary";

		// Prevent collapsing constant, where, and select sections
		const isAlwaysExpanded =
			metaType === "constant" || metaType === "where" || metaType === "select";

		const onLabelClickFn = () => {
			if (isAlwaysExpanded) return;
			if (item.isExpanded()) {
				item.collapse();
			} else {
				item.expand();
			}
		};

		return (
			<button
				type="button"
				className={`uppercase px-1.5 py-0.5 ${isFolder && !isAlwaysExpanded ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
				onClick={onLabelClickFn}
			>
				{label}
			</button>
		);
	};

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large switch over tree node types
	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const metaType = item.getItemData()?.meta?.type;

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
			case "resource":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div className="w-[50%]">
							<ResourceTypeSelect onChange={updateResource} />
						</div>
					</div>
				);
			case "name":
				return (
					<div className="flex w-full items-center justify-between">
						{labelView(item)}
						<div
							className={`w-[50%] ${fieldErrors.has("name") ? "ring-1 ring-border-error rounded-md" : ""}`}
							data-field="name"
						>
							<InputView
								placeholder="ViewDefinition name"
								value={viewDefinition?.name || ""}
								onChange={(value) => updateName(value)}
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
								value={viewDefinition?.status || ""}
								onValueChange={(value: CanonicalResource["status"]) =>
									updateStatus(value)
								}
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
									const path = findPath(selectItems, parentId) ?? [];
									addSelectItem("column", [
										...path,
										...(parentId ? [parentId] : []),
									]);
								}}
							>
								Column
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId) ?? [];
									addSelectItem("forEach", [
										...path,
										...(parentId ? [parentId] : []),
									]);
								}}
							>
								forEach
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId) ?? [];
									addSelectItem("forEachOrNull", [
										...path,
										...(parentId ? [parentId] : []),
									]);
								}}
							>
								forEachOrNull
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const path = findPath(selectItems, parentId) ?? [];
									addSelectItem("unionAll", [
										...path,
										...(parentId ? [parentId] : []),
									]);
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
							onClick={() => removeSelectItem(selectData.nodeId)}
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

				// Context for forEach/forEachOrNull expression is the parent context (not including this node's expression)
				const contextPath = computeFhirPathContext(
					viewDefinitionResourceType,
					selectItems,
					selectData.nodeId,
					false, // don't include target's own expression
				);

				return (
					<div className="flex items-center w-full gap-2">
						{labelView(item)}
						<FhirPathInput
							id={`fhirpath-${selectData.nodeId}`}
							placeholder="Expression"
							value={selectData.expression || ""}
							onChange={(value) =>
								updateSelectExpression(selectData.nodeId, value)
							}
							contextPath={contextPath}
							className="flex-1"
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeSelectItem(selectData.nodeId)}
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
							onClick={() => removeSelectItem(selectData.nodeId)}
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

				// Context for column path includes the parent forEach/forEachOrNull expressions
				const contextPath = computeFhirPathContext(
					viewDefinitionResourceType,
					selectItems,
					selectItemId, // use the parent select item to get context
					true, // include the parent's expression if it's a forEach/forEachOrNull
				);

				const colErrors = columnErrors.get(columnData.nodeId);
				const errExt = colErrors?.has("extension");
				const errName = colErrors?.has("name");
				const errPath = colErrors?.has("path");

				return (
					<div
						className="flex items-center w-full gap-2"
						data-node-id={columnData.nodeId}
					>
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<TextQuote size={12} />
						</span>
						<div
							className={`w-[300px] shrink-0 ${errName ? "ring-1 ring-border-error rounded-md" : ""}`}
						>
							<InputView
								placeholder="Column name"
								value={columnData.name}
								onChange={(value) =>
									updateSelectColumn(
										selectItemId,
										columnData.nodeId,
										"name",
										value,
									)
								}
							/>
						</div>
						<div
							className={`flex-1 min-w-0 ${errPath ? "ring-1 ring-border-error rounded-md" : ""}`}
						>
							<FhirPathInput
								id={`fhirpath-${columnData.nodeId}`}
								placeholder="Path"
								value={columnData.path}
								onChange={(value) =>
									updateSelectColumn(
										selectItemId,
										columnData.nodeId,
										"path",
										value,
									)
								}
								contextPath={contextPath}
							/>
						</div>
						<DeIdentPopover
							config={parseDeIdentExtension(columnData.extension)}
							onChange={(deIdentConfig) =>
								updateColumnDeIdent(
									selectItemId,
									columnData.nodeId,
									deIdentConfig,
								)
							}
							hasError={errExt}
							registerOpen={(openFn) =>
								deidentPopoverRefs.current.set(columnData.nodeId, openFn)
							}
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() =>
								removeSelectColumn(selectItemId, columnData.nodeId)
							}
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
						onClick={() =>
							selectItemId ? addColumnToSelectItem(selectItemId) : undefined
						}
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
						onClick={() => addWhereCondition()}
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
				const whereErr = fieldErrors.has(whereData.nodeId);

				// Where conditions at top level use the resource type as context
				const contextPath = viewDefinitionResourceType || "";

				return (
					<div
						className={`flex items-center w-full gap-2 ${whereErr ? "ring-1 ring-border-error rounded-md" : ""}`}
						data-node-id={whereData.nodeId}
					>
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<Funnel size={12} />
						</span>
						<FhirPathInput
							id={`fhirpath-${whereData.nodeId}`}
							placeholder="Expression"
							value={whereData.path}
							onChange={(value) =>
								updateWhereCondition(whereData.nodeId, value)
							}
							contextPath={contextPath}
						/>
						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeWhereCondition(whereData.nodeId)}
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
						onClick={() => addConstant()}
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
				const nid = constantData.nodeId;
				const nameErr = fieldErrors.has(`${nid}:name`) || fieldErrors.has(nid);
				const valErr = fieldErrors.has(`${nid}:value`) || fieldErrors.has(nid);

				return (
					<div className="flex items-center w-full gap-2" data-node-id={nid}>
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
							<Pi size={12} />
						</span>
						<div
							className={nameErr ? "ring-1 ring-border-error rounded-md" : ""}
						>
							<InputView
								placeholder="Name"
								value={constantData.name}
								onChange={(value) =>
									updateConstant(constantData.nodeId, "name", value)
								}
							/>
						</div>
						<div
							className={valErr ? "ring-1 ring-border-error rounded-md" : ""}
						>
							<InputView
								placeholder="Value"
								value={constantData.valueString}
								onChange={(value) =>
									updateConstant(constantData.nodeId, "valueString", value)
								}
							/>
						</div>

						<Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeConstant(constantData.nodeId)}
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

	// Populate form actions on actionsRef
	const serializeSelectItems = useCallback(
		(items: SelectItemInternal[]): FormTreeSelectItem[] => {
			return items.map((item) => ({
				nodeId: item.nodeId,
				type: item.type,
				...(item.expression !== undefined
					? { expression: item.expression }
					: {}),
				...(item.column
					? {
							columns: item.column.map((c) => ({
								nodeId: (c as { nodeId?: string }).nodeId ?? "",
								name: c.name,
								path: c.path,
							})),
						}
					: {}),
				...(item.children?.length
					? { children: serializeSelectItems(item.children) }
					: {}),
			}));
		},
		[],
	);

	if (actionsRef.current) {
		actionsRef.current.getFormTree = () => ({
			name: viewDefinition?.name,
			status: viewDefinition?.status,
			resourceType: viewDefinitionResourceType,
			constants: constants.map((c) => ({
				nodeId: c.nodeId,
				name: c.name,
				value: c.valueString ?? "",
			})),
			where: whereConditions.map((w) => ({
				nodeId: w.nodeId,
				path: w.path,
			})),
			select: serializeSelectItems(selectItems),
		});
		actionsRef.current.setName = updateName;
		actionsRef.current.setStatus = updateStatus as (status: string) => void;
		actionsRef.current.addConstant = addConstant;
		actionsRef.current.updateConstant = updateConstant;
		actionsRef.current.removeConstant = removeConstant;
		actionsRef.current.addWhere = addWhereCondition;
		actionsRef.current.updateWhere = updateWhereCondition;
		actionsRef.current.removeWhere = removeWhereCondition;
		actionsRef.current.addSelect = (type, parentNodeId?) => {
			if (parentNodeId) {
				const path = findPath(selectItems, parentNodeId) ?? [];
				return addSelectItem(type, [...path, parentNodeId]);
			}
			return addSelectItem(type);
		};
		actionsRef.current.removeSelect = removeSelectItem;
		actionsRef.current.updateSelectExpression = updateSelectExpression;
		actionsRef.current.addColumn = addColumnToSelectItem;
		actionsRef.current.updateColumn = updateSelectColumn;
		actionsRef.current.removeColumn = removeSelectColumn;
	}

	if (!viewDefinition) {
		return null;
	}

	return (
		<FhirPathLspProvider>
			<TreeView
				itemLabelClassFn={(item: ItemInstance<TreeViewItem<ItemMeta>>) => {
					const metaType = item.getItemData()?.meta?.type;

					if (
						metaType === "constant" ||
						metaType === "select" ||
						metaType === "where" ||
						metaType === "properties"
					) {
						return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
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
				customItemView={customItemView}
				disableHover={true}
				chevronClassName="self-center cursor-pointer"
				onItemLabelClick={(item) => {
					if (item.isFolder()) {
						item.isExpanded() ? item.collapse() : item.expand();
					}
				}}
				canReorder={true}
				onDropFn={onDropTreeItem}
				expandedItems={expandedItems}
				onExpandedItemsChange={onExpandedItemsChange}
			/>
		</FhirPathLspProvider>
	);
};
