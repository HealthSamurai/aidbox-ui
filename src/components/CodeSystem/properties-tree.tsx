import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { Plus, Tag, X } from "lucide-react";
import * as React from "react";
import { readUrlHistory } from "../../utils/url-history";
import { useCodeSystemContext } from "./context";
import type {
	CodeSystemConcept,
	CodeSystemConceptProperty,
	CodeSystemContent,
	CodeSystemHierarchyMeaning,
	CodeSystemStatus,
} from "./types";

const URL_HISTORY_KEY = "codesystem-builder:url-history";

type ItemMeta = {
	type:
		| "properties"
		| "url"
		| "version"
		| "content"
		| "hierarchyMeaning"
		| "status"
		| "name"
		| "description"
		| "concept"
		| "concept-row"
		| "concept-add"
		| "concept-nested-add"
		| "concept-child-section"
		| "concept-property-section"
		| "concept-property-row"
		| "concept-property-add";
	conceptPath?: number[];
	propertyIndex?: number;
};

const STATUSES = ["draft", "active", "retired", "unknown"] as const;
const CONTENT_TYPES = [
	"not-present",
	"example",
	"fragment",
	"complete",
	"supplement",
] as const;
const HIERARCHY_MEANINGS = [
	"grouped-by",
	"is-a",
	"part-of",
	"classified-with",
] as const;
const PROPERTY_TYPES = [
	"code",
	"string",
	"integer",
	"boolean",
	"dateTime",
	"decimal",
] as const;
type PropertyType = (typeof PROPERTY_TYPES)[number];

const detectPropertyType = (p: CodeSystemConceptProperty): PropertyType => {
	if (p.valueCode !== undefined) return "code";
	if (p.valueInteger !== undefined) return "integer";
	if (p.valueBoolean !== undefined) return "boolean";
	if (p.valueDateTime !== undefined) return "dateTime";
	if (p.valueDecimal !== undefined) return "decimal";
	return "string";
};

const emptyValuePatch = (): Partial<CodeSystemConceptProperty> => ({
	valueCode: undefined,
	valueString: undefined,
	valueInteger: undefined,
	valueBoolean: undefined,
	valueDateTime: undefined,
	valueDecimal: undefined,
});

const LABEL_OVERRIDES: Partial<Record<ItemMeta["type"], string>> = {
	hierarchyMeaning: "hierarchy meaning",
	concept: "concepts",
	"concept-property-section": "properties",
	"concept-child-section": "child concepts",
};

const pathsEqual = (a: number[], b: number[]) =>
	a.length === b.length && a.every((x, i) => x === b[i]);

const conceptRowId = (path: number[]) => `_concept_${path.join("_")}`;
const conceptIndexLabel = (path: number[]) => path.map((i) => i + 1).join(".");

function InputView({
	placeholder,
	value,
	onChange,
	autoFocusToken,
	className,
	name,
	autoComplete,
	list,
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	autoFocusToken?: number | null;
	className?: string;
	name?: string;
	autoComplete?: string;
	list?: string;
}) {
	const [localValue, setLocalValue] = React.useState(value ?? "");
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	React.useEffect(() => {
		setLocalValue(value ?? "");
	}, [value]);

	React.useEffect(() => {
		if (autoFocusToken != null) inputRef.current?.focus();
	}, [autoFocusToken]);

	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const handleChange = (newValue: string) => {
		setLocalValue(newValue);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			if (onChange && newValue !== value) onChange(newValue);
		}, 500);
	};

	return (
		<HSComp.Input
			ref={inputRef}
			name={name}
			autoComplete={autoComplete}
			list={list}
			className={`h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary focus:ring-1 focus:ring-border-link ${className ?? ""}`}
			placeholder={placeholder}
			value={localValue}
			onChange={(e) => handleChange(e.target.value)}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		/>
	);
}

function labelView(item: ItemInstance<TreeViewItem<ItemMeta>>) {
	const metaType = item.getItemData()?.meta?.type;
	const isFolder = item.isFolder();
	const isTopSectionFolder =
		metaType === "properties" || metaType === "concept";

	const additionalClass = isTopSectionFolder
		? "text-text-info-primary px-1!"
		: "inline-flex items-center justify-center min-w-7 min-h-7 text-text-info-primary bg-bg-info-primary";

	const label = (metaType && LABEL_OVERRIDES[metaType]) ?? metaType;

	const onLabelClickFn = (e: React.MouseEvent) => {
		if (!isFolder) return;
		e.stopPropagation();
		if (item.isExpanded()) item.collapse();
		else item.expand();
	};

	return (
		<button
			type="button"
			tabIndex={-1}
			className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
			onClick={onLabelClickFn}
		>
			{label}
		</button>
	);
}

export function PropertiesTree() {
	const { codeSystem, updateCodeSystem, missingFields, setMissingFields } =
		useCodeSystemContext();
	const [urlHistory] = React.useState<string[]>(() =>
		readUrlHistory(URL_HISTORY_KEY),
	);

	const dismissMissing = React.useCallback(
		(field: string) => {
			setMissingFields((prev) => {
				if (!prev.has(field)) return prev;
				const next = new Set(prev);
				next.delete(field);
				return next;
			});
		},
		[setMissingFields],
	);

	const updateUrl = (value: string) =>
		updateCodeSystem((cs) => ({ ...cs, url: value || undefined }));
	const updateVersion = (value: string) =>
		updateCodeSystem((cs) => ({ ...cs, version: value || undefined }));
	const updateName = (value: string) =>
		updateCodeSystem((cs) => ({ ...cs, name: value || undefined }));
	const updateDescription = (value: string) =>
		updateCodeSystem((cs) => ({ ...cs, description: value || undefined }));
	const updateHierarchyMeaning = (value: string) =>
		updateCodeSystem((cs) => ({
			...cs,
			hierarchyMeaning: (value || undefined) as
				| CodeSystemHierarchyMeaning
				| undefined,
		}));
	const updateStatus = (value: string) => {
		updateCodeSystem((cs) => ({
			...cs,
			status: (value || undefined) as CodeSystemStatus | undefined,
		}));
		if (value) dismissMissing("status");
	};
	const updateContent = (value: string) =>
		updateCodeSystem((cs) => ({
			...cs,
			content: (value || undefined) as CodeSystemContent | undefined,
		}));

	const getConceptAt = (path: number[]): CodeSystemConcept | undefined => {
		let arr: CodeSystemConcept[] | undefined = codeSystem.concept;
		let c: CodeSystemConcept | undefined;
		for (const i of path) {
			c = arr?.[i];
			if (!c) return undefined;
			arr = c.concept;
		}
		return c;
	};

	const mutateConcepts = (
		fn: (arr: CodeSystemConcept[]) => CodeSystemConcept[] | undefined,
	) =>
		updateCodeSystem((cs) => {
			const next = fn((cs.concept ?? []).slice());
			return { ...cs, concept: next && next.length > 0 ? next : undefined };
		});

	const updateAtPath = (
		arr: CodeSystemConcept[],
		path: number[],
		fn: (c: CodeSystemConcept) => CodeSystemConcept,
	): CodeSystemConcept[] => {
		const head = path[0];
		if (head === undefined) return arr;
		const rest = path.slice(1);
		const target = arr[head];
		if (!target) return arr;
		const next = arr.slice();
		if (rest.length === 0) {
			next[head] = fn(target);
		} else {
			next[head] = {
				...target,
				concept: updateAtPath(target.concept ?? [], rest, fn),
			};
		}
		return next;
	};

	const removeAtPath = (
		arr: CodeSystemConcept[],
		path: number[],
	): CodeSystemConcept[] => {
		const head = path[0];
		if (head === undefined) return arr;
		const rest = path.slice(1);
		if (rest.length === 0) return arr.filter((_, i) => i !== head);
		const target = arr[head];
		if (!target) return arr;
		const next = arr.slice();
		const childArr = removeAtPath(target.concept ?? [], rest);
		next[head] = {
			...target,
			concept: childArr.length > 0 ? childArr : undefined,
		};
		return next;
	};

	const [expandedItems, setExpandedItems] = React.useState<string[]>(() => {
		const out = ["_properties", "_concept"];
		const root = codeSystem.concept ?? [];
		let total = 0;
		const count = (arr: CodeSystemConcept[]) => {
			arr.forEach((c) => {
				total++;
				if (c.concept) count(c.concept);
			});
		};
		count(root);
		if (total > 1000) return out;
		const walk = (path: number[], arr: CodeSystemConcept[]) => {
			arr.forEach((c, i) => {
				const myPath = [...path, i];
				const hasChildren = (c.concept?.length ?? 0) > 0;
				if (hasChildren) {
					const rowId = conceptRowId(myPath);
					out.push(rowId, `${rowId}_child_section`);
					walk(myPath, c.concept ?? []);
				}
			});
		};
		walk([], root);
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	});

	const [focusTarget, setFocusTarget] = React.useState<{
		path: number[];
		tick: number;
	} | null>(null);

	// max number-of-digits per sibling group, keyed by parent path
	const maxDigitsByParent = React.useMemo(() => {
		const map = new Map<string, number>();
		const walk = (path: number[], arr: CodeSystemConcept[]) => {
			map.set(path.join("."), String(Math.max(arr.length, 1)).length);
			arr.forEach((c, i) => {
				if (c.concept && c.concept.length > 0) {
					walk([...path, i], c.concept);
				}
			});
		};
		walk([], codeSystem.concept ?? []);
		return map;
	}, [codeSystem.concept]);

	const addConceptAt = (parentPath: number[]) => {
		const parentChildrenLen =
			parentPath.length === 0
				? (codeSystem.concept?.length ?? 0)
				: (getConceptAt(parentPath)?.concept?.length ?? 0);
		const newPath = [...parentPath, parentChildrenLen];
		mutateConcepts((arr) => {
			if (parentPath.length === 0) {
				return [...arr, {}];
			}
			return updateAtPath(arr, parentPath, (c) => ({
				...c,
				concept: [...(c.concept ?? []), {}],
			}));
		});
		const toExpand: string[] = [];
		if (parentPath.length === 0) {
			toExpand.push("_concept");
		} else {
			const parentRowId = conceptRowId(parentPath);
			toExpand.push(parentRowId, `${parentRowId}_child_section`);
		}
		setExpandedItems((prev) => Array.from(new Set([...prev, ...toExpand])));
		setFocusTarget({ path: newPath, tick: Date.now() });
	};

	const removeConceptAt = (path: number[]) =>
		mutateConcepts((arr) => removeAtPath(arr, path));

	const updateConceptField = (
		path: number[],
		patch: Partial<CodeSystemConcept>,
	) =>
		mutateConcepts((arr) =>
			updateAtPath(arr, path, (c) => ({ ...c, ...patch })),
		);

	const addPropertyAt = (path: number[]) => {
		mutateConcepts((arr) =>
			updateAtPath(arr, path, (c) => ({
				...c,
				property: [...(c.property ?? []), {}],
			})),
		);
		const rowId = conceptRowId(path);
		setExpandedItems((prev) =>
			Array.from(new Set([...prev, rowId, `${rowId}_props_section`])),
		);
	};

	const updatePropertyAt = (
		path: number[],
		pi: number,
		patch: Partial<CodeSystemConceptProperty>,
	) =>
		mutateConcepts((arr) =>
			updateAtPath(arr, path, (c) => {
				const props = (c.property ?? []).slice();
				props[pi] = { ...props[pi], ...patch };
				return { ...c, property: props };
			}),
		);

	const setPropertyType = (path: number[], pi: number, type: PropertyType) => {
		const defaults: Partial<CodeSystemConceptProperty> = {
			...emptyValuePatch(),
		};
		switch (type) {
			case "code":
				defaults.valueCode = "";
				break;
			case "string":
				defaults.valueString = "";
				break;
			case "integer":
				defaults.valueInteger = 0;
				break;
			case "boolean":
				defaults.valueBoolean = false;
				break;
			case "dateTime":
				defaults.valueDateTime = "";
				break;
			case "decimal":
				defaults.valueDecimal = 0;
				break;
		}
		updatePropertyAt(path, pi, defaults);
	};

	const setPropertyValueString = (
		path: number[],
		pi: number,
		type: PropertyType,
		raw: string,
	) => {
		const patch: Partial<CodeSystemConceptProperty> = { ...emptyValuePatch() };
		switch (type) {
			case "code":
				patch.valueCode = raw;
				break;
			case "string":
				patch.valueString = raw;
				break;
			case "dateTime":
				patch.valueDateTime = raw;
				break;
			case "integer": {
				const n = Number.parseInt(raw, 10);
				patch.valueInteger = Number.isFinite(n) ? n : undefined;
				break;
			}
			case "decimal": {
				const n = Number.parseFloat(raw);
				patch.valueDecimal = Number.isFinite(n) ? n : undefined;
				break;
			}
			case "boolean":
				break;
		}
		updatePropertyAt(path, pi, patch);
	};

	const removePropertyAt = (path: number[], pi: number) =>
		mutateConcepts((arr) =>
			updateAtPath(arr, path, (c) => {
				const props = (c.property ?? []).filter((_, i) => i !== pi);
				return { ...c, property: props.length > 0 ? props : undefined };
			}),
		);

	const tree: Record<string, TreeViewItem<ItemMeta>> = React.useMemo(() => {
		const out: Record<string, TreeViewItem<ItemMeta>> = {
			root: { name: "root", children: ["_properties", "_concept"] },
			_properties: {
				name: "_properties",
				meta: { type: "properties" },
				children: [
					"_url",
					"_version",
					"_name",
					"_description",
					"_content",
					"_hierarchyMeaning",
					"_status",
				],
			},
			_url: { name: "_url", meta: { type: "url" } },
			_version: { name: "_version", meta: { type: "version" } },
			_content: { name: "_content", meta: { type: "content" } },
			_hierarchyMeaning: {
				name: "_hierarchyMeaning",
				meta: { type: "hierarchyMeaning" },
			},
			_status: { name: "_status", meta: { type: "status" } },
			_name: { name: "_name", meta: { type: "name" } },
			_description: { name: "_description", meta: { type: "description" } },
		};

		const buildConceptSubtree = (
			path: number[],
			concepts: CodeSystemConcept[],
		) => {
			concepts.forEach((c, i) => {
				const myPath = [...path, i];
				const rowId = conceptRowId(myPath);

				const propsSectionId = `${rowId}_props_section`;
				const propsChildren: string[] = [];
				(c.property ?? []).forEach((_, pi) => {
					const pid = `${rowId}_prop_${pi}`;
					propsChildren.push(pid);
					out[pid] = {
						name: pid,
						meta: {
							type: "concept-property-row",
							conceptPath: myPath,
							propertyIndex: pi,
						},
					};
				});
				const propAddId = `${rowId}_prop_add`;
				propsChildren.push(propAddId);
				out[propAddId] = {
					name: propAddId,
					meta: { type: "concept-property-add", conceptPath: myPath },
				};
				out[propsSectionId] = {
					name: propsSectionId,
					meta: { type: "concept-property-section", conceptPath: myPath },
					children: propsChildren,
				};

				const nested = c.concept ?? [];
				buildConceptSubtree(myPath, nested);
				const nestedIds = nested.map((_, ni) => conceptRowId([...myPath, ni]));

				const conceptAddId = `${rowId}_concept_add`;
				out[conceptAddId] = {
					name: conceptAddId,
					meta: { type: "concept-nested-add", conceptPath: myPath },
				};

				const childSectionId = `${rowId}_child_section`;
				out[childSectionId] = {
					name: childSectionId,
					meta: { type: "concept-child-section", conceptPath: myPath },
					children: [...nestedIds, conceptAddId],
				};

				out[rowId] = {
					name: rowId,
					meta: { type: "concept-row", conceptPath: myPath },
					children: [propsSectionId, childSectionId],
				};
			});
		};

		const concepts = codeSystem.concept ?? [];
		buildConceptSubtree([], concepts);
		const conceptChildren = concepts.map((_, i) => conceptRowId([i]));
		conceptChildren.push("_concept_add");
		out._concept = {
			name: "_concept",
			meta: { type: "concept" },
			children: conceptChildren,
		};
		out._concept_add = { name: "_concept_add", meta: { type: "concept-add" } };

		return out;
	}, [codeSystem.concept]);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large switch over tree node types
	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const metaType = meta?.type;
		switch (metaType) {
			case "properties":
			case "concept":
				return <div>{labelView(item)}</div>;
			case "concept-property-section": {
				const path = meta?.conceptPath ?? [];
				const concept = getConceptAt(path);
				const count = concept?.property?.length ?? 0;
				const isFolder = item.isFolder();
				const toggle = (e: React.MouseEvent) => {
					if (!isFolder) return;
					e.stopPropagation();
					if (item.isExpanded()) item.collapse();
					else item.expand();
				};
				return (
					<div>
						<button
							type="button"
							tabIndex={-1}
							className={`inline-flex items-center justify-center min-w-7 min-h-7 uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md text-text-info-primary bg-bg-info-primary`}
							onClick={toggle}
						>
							properties ({count})
						</button>
					</div>
				);
			}
			case "concept-child-section": {
				const path = meta?.conceptPath ?? [];
				const concept = getConceptAt(path);
				const count = concept?.concept?.length ?? 0;
				const isFolder = item.isFolder();
				const toggle = (e: React.MouseEvent) => {
					if (!isFolder) return;
					e.stopPropagation();
					if (item.isExpanded()) item.collapse();
					else item.expand();
				};
				return (
					<div>
						<button
							type="button"
							tabIndex={-1}
							className={`inline-flex items-center justify-center min-w-7 min-h-7 uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md text-text-info-primary bg-bg-info-primary`}
							onClick={toggle}
						>
							child concepts ({count})
						</button>
					</div>
				);
			}
			case "url":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								name="codesystem-url"
								autoComplete="on"
								list="codesystem-builder-url-history"
								placeholder="Canonical identifier for this code system, represented as a URI (globally unique)"
								value={codeSystem.url}
								onChange={updateUrl}
							/>
						</div>
					</div>
				);
			case "version":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Business version of the code system"
								value={codeSystem.version}
								onChange={updateVersion}
							/>
						</div>
					</div>
				);
			case "content":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[200px]">
							<HSComp.Select
								value={codeSystem.content ?? ""}
								onValueChange={updateContent}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="content" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{CONTENT_TYPES.map((c) => (
										<HSComp.SelectItem key={c} value={c}>
											{c}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			case "status": {
				const isMissing = missingFields.has("status");
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div
							className={`w-[200px] ${isMissing ? "ring-1 ring-border-error rounded-md" : ""}`}
						>
							<HSComp.Select
								value={codeSystem.status ?? ""}
								onValueChange={updateStatus}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="status" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{STATUSES.map((s) => (
										<HSComp.SelectItem key={s} value={s}>
											{s}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			}
			case "name":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Name for this code system (computer friendly)"
								value={codeSystem.name}
								onChange={updateName}
							/>
						</div>
					</div>
				);
			case "hierarchyMeaning":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[200px]">
							<HSComp.Select
								value={codeSystem.hierarchyMeaning ?? ""}
								onValueChange={updateHierarchyMeaning}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="hierarchy meaning" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{HIERARCHY_MEANINGS.map((m) => (
										<HSComp.SelectItem key={m} value={m}>
											{m}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			case "description":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Natural language description of the code system"
								value={codeSystem.description}
								onChange={updateDescription}
							/>
						</div>
					</div>
				);
			case "concept-row": {
				const path = meta?.conceptPath ?? [];
				const concept = getConceptAt(path);
				if (!concept) return null;
				const focusToken =
					focusTarget && pathsEqual(focusTarget.path, path)
						? focusTarget.tick
						: null;
				const isFolder = item.isFolder();
				const toggle = (e: React.MouseEvent) => {
					if (!isFolder) return;
					e.stopPropagation();
					if (item.isExpanded()) item.collapse();
					else item.expand();
				};
				const parentPath = path.slice(0, -1);
				const prefixLabel = conceptIndexLabel(parentPath);
				const maxDigits = maxDigitsByParent.get(parentPath.join(".")) ?? 1;
				const labelChars =
					(prefixLabel.length > 0 ? prefixLabel.length + 1 : 0) + maxDigits;
				return (
					<div className="flex w-full items-center gap-2">
						<button
							type="button"
							tabIndex={-1}
							className={`shrink-0 inline-flex items-center justify-start min-h-7 uppercase px-[2px] py-0.5 rounded-md text-text-info-primary tabular-nums ${isFolder ? "cursor-pointer" : ""}`}
							style={{ minWidth: `calc(${labelChars}ch + 4px)` }}
							onClick={toggle}
						>
							{conceptIndexLabel(path)}
						</button>
						<div className="w-[175px] shrink-0">
							<InputView
								placeholder="code"
								value={concept.code}
								onChange={(v) =>
									updateConceptField(path, { code: v || undefined })
								}
								autoFocusToken={focusToken}
								className="font-mono text-xs"
							/>
						</div>
						<div className="w-[250px] shrink-0">
							<InputView
								placeholder="Text to display to the user"
								value={concept.display}
								onChange={(v) =>
									updateConceptField(path, { display: v || undefined })
								}
							/>
						</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Formal definition"
								value={concept.definition}
								onChange={(v) =>
									updateConceptField(path, { definition: v || undefined })
								}
							/>
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeConceptAt(path)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "concept-property-row": {
				const path = meta?.conceptPath ?? [];
				const pi = meta?.propertyIndex ?? -1;
				const concept = getConceptAt(path);
				const prop = concept?.property?.[pi];
				if (!prop) return null;
				const type = detectPropertyType(prop);
				const stringValue =
					type === "code"
						? (prop.valueCode ?? "")
						: type === "string"
							? (prop.valueString ?? "")
							: type === "integer"
								? (prop.valueInteger?.toString() ?? "")
								: type === "dateTime"
									? (prop.valueDateTime ?? "")
									: type === "decimal"
										? (prop.valueDecimal?.toString() ?? "")
										: "";
				return (
					<div className="flex w-full items-center gap-2 pl-0.5">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1 shrink-0">
							<Tag size={12} />
						</span>
						<div className="w-[175px] shrink-0">
							<InputView
								placeholder="property name"
								value={prop.code}
								onChange={(v) =>
									updatePropertyAt(path, pi, { code: v || undefined })
								}
								className="font-mono text-xs"
							/>
						</div>
						<div className="w-[120px] shrink-0">
							<HSComp.Select
								value={type}
								onValueChange={(v) =>
									setPropertyType(path, pi, v as PropertyType)
								}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="type" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{PROPERTY_TYPES.map((t) => (
										<HSComp.SelectItem key={t} value={t}>
											{t}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
						<div className="flex-1 min-w-0">
							{type === "boolean" ? (
								<div className="flex items-center h-7">
									<HSComp.Switch
										checked={prop.valueBoolean === true}
										onCheckedChange={(c) =>
											updatePropertyAt(path, pi, {
												...emptyValuePatch(),
												valueBoolean: c === true,
											})
										}
										onClick={(e) => e.stopPropagation()}
										onMouseDown={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									/>
								</div>
							) : (
								<InputView
									placeholder="value"
									value={stringValue}
									onChange={(v) => setPropertyValueString(path, pi, type, v)}
								/>
							)}
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removePropertyAt(path, pi)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "concept-add":
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addConceptAt([])}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Concept</span>
						</span>
					</HSComp.Button>
				);
			case "concept-nested-add": {
				const path = meta?.conceptPath ?? [];
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addConceptAt(path)}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Concept</span>
						</span>
					</HSComp.Button>
				);
			}
			case "concept-property-add": {
				const path = meta?.conceptPath ?? [];
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addPropertyAt(path)}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Property</span>
						</span>
					</HSComp.Button>
				);
			}
			default:
				return <div>{labelView(item)}</div>;
		}
	};

	return (
		<div>
			<TreeView
				items={tree}
				rootItemId="root"
				customItemView={customItemView}
				disableHover={true}
				chevronClassName="self-center cursor-pointer"
				expandedItems={expandedItems}
				onExpandedItemsChange={(next) => {
					const prevSet = new Set(expandedItems);
					const extra: string[] = [];
					for (const id of next) {
						if (prevSet.has(id)) continue;
						const node = tree[id];
						if (node?.meta?.type === "concept-row") {
							const path = node.meta.conceptPath ?? [];
							const hasChildren =
								(getConceptAt(path)?.concept?.length ?? 0) > 0;
							if (hasChildren) {
								const childSection = `${id}_child_section`;
								if (tree[childSection]) extra.push(childSection);
							}
						}
					}
					setExpandedItems(
						extra.length === 0
							? next
							: Array.from(new Set([...next, ...extra])),
					);
				}}
				onItemLabelClick={(item) => {
					if (item.isFolder()) {
						if (item.isExpanded()) item.collapse();
						else item.expand();
					}
				}}
				itemLabelClassFn={(item: ItemInstance<TreeViewItem<ItemMeta>>) => {
					const metaType = item.getItemData()?.meta?.type;
					if (metaType === "properties" || metaType === "concept") {
						return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
					}
					return "pr-0";
				}}
			/>
			<datalist id="codesystem-builder-url-history">
				{urlHistory.map((u) => (
					<option key={u} value={u} />
				))}
			</datalist>
		</div>
	);
}
