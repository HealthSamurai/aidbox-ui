import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { AlignLeft, Play, Plus, X } from "lucide-react";
import * as React from "react";
import { format as formatSQL } from "sql-formatter";
import { readUrlHistory } from "../../utils/url-history";
import { useSQLQueryContext } from "./context";
import {
	type ResolvedParameter,
	useResolvedParameterTree,
} from "./resolve-tree";
import { ResourcePicker } from "./resource-picker";
import { SqlEditor } from "./sql-editor";
import {
	FHIR_PARAMETER_TYPES,
	LABEL_REGEX,
	type SQLDependsOn,
	type SQLParameter,
	sqlLibraryKindMeta,
} from "./types";

type ItemMeta = {
	type:
		| "properties"
		| "title"
		| "description"
		| "url"
		| "depends-on"
		| "depends-on-value"
		| "depends-on-add"
		| "parameter"
		| "parameter-value"
		| "parameter-inherited"
		| "parameter-add"
		| "sql"
		| "sql-value";
	dependsOnIndex?: number;
	parameterIndex?: number;
	inheritedIndex?: number;
};

function InputView({
	placeholder,
	value,
	onChange,
	className,
	invalid,
	disabled,
	leftSlot,
	dashed,
	name,
	autoComplete,
	list,
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	className?: string;
	invalid?: boolean;
	disabled?: boolean;
	leftSlot?: React.ReactNode;
	dashed?: boolean;
	name?: string;
	autoComplete?: string;
	list?: string;
}) {
	const [localValue, setLocalValue] = React.useState(value ?? "");

	React.useEffect(() => {
		setLocalValue(value ?? "");
	}, [value]);

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

	const borderCls = dashed
		? invalid
			? "border border-dashed border-border-error focus:border-border-error focus-visible:border-border-error hover:border-border-error"
			: "border border-dashed border-border-secondary hover:border-border-secondary"
		: "border-none";
	const ringCls = invalid
		? dashed
			? ""
			: "ring-1 ring-border-error rounded-md focus:ring-border-error"
		: "focus:ring-1 focus:ring-border-link";
	const paddingCls = leftSlot ? "pl-9 pr-2" : "px-2";
	return (
		<HSComp.Input
			disabled={disabled}
			leftSlot={leftSlot}
			name={name}
			autoComplete={autoComplete}
			list={list}
			className={`h-7 py-1 ${paddingCls} bg-bg-primary ${borderCls} hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary disabled:cursor-not-allowed ${ringCls} ${className ?? ""}`}
			placeholder={placeholder}
			value={localValue}
			onChange={(e) => handleChange(e.target.value)}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		/>
	);
}

function SqlValueCell() {
	const ref = React.useRef<HTMLDivElement>(null);
	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const stop = (e: Event) => e.stopPropagation();
		el.addEventListener("keydown", stop);
		el.addEventListener("click", stop);
		el.addEventListener("dragstart", stop);
		return () => {
			el.removeEventListener("keydown", stop);
			el.removeEventListener("click", stop);
			el.removeEventListener("dragstart", stop);
		};
	}, []);
	return (
		<div ref={ref} className="w-full -ml-2.5">
			<SqlEditor />
		</div>
	);
}

function labelView(item: ItemInstance<TreeViewItem<ItemMeta>>) {
	const metaType = item.getItemData()?.meta?.type;
	const isFolder = item.isFolder();

	const isSectionFolder =
		metaType === "properties" ||
		metaType === "depends-on" ||
		metaType === "parameter" ||
		metaType === "sql";

	const additionalClass = isSectionFolder
		? "text-text-info-primary px-1!"
		: "text-text-info-primary bg-bg-info-primary";

	const onLabelClickFn = (e: React.MouseEvent) => {
		if (!isFolder) return;
		e.stopPropagation();
		if (item.isExpanded()) item.collapse();
		else item.expand();
	};

	return (
		<button
			type="button"
			className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
			onClick={onLabelClickFn}
		>
			{metaType === "depends-on"
				? "Dependencies"
				: metaType === "parameter"
					? "Parameters"
					: metaType === "depends-on-value"
						? "depends-on"
						: metaType === "parameter-value" ||
								metaType === "parameter-inherited"
							? "parameter"
							: metaType}
		</button>
	);
}

function ParamValueField({
	name,
	type,
	value,
	onChange,
	missing,
}: {
	name: string | undefined;
	type: string;
	value: string;
	onChange: (value: string) => void;
	missing?: boolean;
}) {
	const hasName = !!name;
	const wrapperProps =
		missing && hasName
			? { "data-param-missing": name as string }
			: ({} as Record<string, string>);
	if (type === "boolean") {
		return (
			<div
				className={`flex-1 min-w-0 max-w-[200px] flex items-center gap-2 pl-2.5 ${missing ? "ring-1 ring-border-error rounded-md" : ""}`}
				onClick={(e) => e.stopPropagation()}
				onMouseDown={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="presentation"
				{...wrapperProps}
			>
				<Play size={12} className="text-text-link shrink-0" />
				<HSComp.Switch
					checked={value === "true"}
					onCheckedChange={(c) => onChange(c ? "true" : "false")}
				/>
			</div>
		);
	}
	return (
		<div className="flex-1 min-w-0 max-w-[200px] relative" {...wrapperProps}>
			<Play
				size={12}
				className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-link pointer-events-none z-10"
			/>
			<InputView
				placeholder="RUN parameter value"
				value={value}
				onChange={onChange}
				className="font-mono text-xs pl-7"
				invalid={missing}
				dashed
			/>
		</div>
	);
}

function SourceTooltipContent({
	sources,
	hasConflict,
}: {
	sources: ResolvedParameter["sources"];
	hasConflict: boolean;
}) {
	return (
		<HSComp.TooltipContent
			side="bottom"
			align="start"
			className="max-w-md p-0 bg-bg-primary text-text-primary border border-border-primary shadow-md"
		>
			<div className="flex flex-col">
				{hasConflict && (
					<div className="px-3 py-2 text-xs text-text-error-primary border-b border-border-primary">
						Type conflict across sources
					</div>
				)}
				{sources.map((s, i) => (
					<div
						key={`${s.libraryId ?? s.canonical}-${i}`}
						className={`flex flex-col gap-0.5 px-3 py-2 min-w-0 ${
							i > 0 ? "border-t border-border-primary" : ""
						}`}
					>
						<span className="typo-label-tiny text-text-tertiary">SQLQuery</span>
						<span className="truncate">
							{s.libraryTitle || s.libraryName || s.libraryId || s.canonical}
						</span>
						<span className="font-mono text-xs text-text-tertiary truncate">
							{s.libraryDescription || s.canonical}
						</span>
					</div>
				))}
			</div>
		</HSComp.TooltipContent>
	);
}

function InheritedParameterRow({
	entry,
	hasConflict,
	value,
	onValueChange,
	missing,
}: {
	entry: ResolvedParameter;
	hasConflict: boolean;
	value: string;
	onValueChange: (value: string) => void;
	missing: boolean;
}) {
	const disabledRingClass = hasConflict
		? "ring-1 ring-border-error rounded-md"
		: "";
	return (
		<div className="flex w-full items-center gap-2">
			<HSComp.Tooltip delayDuration={250}>
				<HSComp.TooltipTrigger asChild>
					<div className="flex items-center gap-2">
						<div
							className={`w-[226px] shrink-0 cursor-not-allowed ${disabledRingClass}`}
						>
							<InputView
								disabled
								placeholder="Name"
								value={entry.name}
								className="font-mono text-xs"
							/>
						</div>
						<div className={`w-28 cursor-not-allowed ${disabledRingClass}`}>
							<HSComp.Select value={entry.type ?? "string"} disabled>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{FHIR_PARAMETER_TYPES.map((t) => (
										<HSComp.SelectItem key={t} value={t}>
											{t}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				</HSComp.TooltipTrigger>
				<SourceTooltipContent
					sources={entry.sources}
					hasConflict={hasConflict}
				/>
			</HSComp.Tooltip>
			<ParamValueField
				name={entry.name}
				type={entry.type ?? "string"}
				value={value}
				onChange={onValueChange}
				missing={missing}
			/>
		</div>
	);
}

export function PropertiesTree() {
	const { library, updateLibrary, paramValues, setParamValue, missingParams } =
		useSQLQueryContext();
	const kindMeta = sqlLibraryKindMeta(library);
	const treeContainerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const el = treeContainerRef.current;
		if (!el) return;
		const handler = (e: Event) => e.preventDefault();
		el.addEventListener("dragstart", handler);
		return () => el.removeEventListener("dragstart", handler);
	}, []);
	const firstMissingName = React.useMemo(() => {
		for (const n of missingParams) {
			if ((paramValues[n] ?? "") === "") return n;
		}
		return null;
	}, [missingParams, paramValues]);

	React.useEffect(() => {
		if (!firstMissingName) return;
		setExpandedItems((prev) =>
			prev.includes("_parameter") ? prev : [...prev, "_parameter"],
		);
		let cancelled = false;
		const id = requestAnimationFrame(() => {
			if (cancelled) return;
			requestAnimationFrame(() => {
				if (cancelled) return;
				const el = treeContainerRef.current?.querySelector(
					`[data-param-missing="${CSS.escape(firstMissingName)}"]`,
				) as HTMLElement | null;
				if (!el) return;
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				const input = el.querySelector("input,button") as HTMLElement | null;
				input?.focus();
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(id);
		};
	}, [firstMissingName]);

	const dependsOn = React.useMemo(
		() =>
			(library.relatedArtifact ?? []).filter((ra) => ra.type === "depends-on"),
		[library.relatedArtifact],
	);

	const parameters = library.parameter ?? [];

	const { tree: resolvedTree } = useResolvedParameterTree(library);

	const [focusRequest, setFocusRequest] = React.useState<{
		key: string;
		nonce: number;
	} | null>(null);

	const requestFocus = React.useCallback((key: string) => {
		setFocusRequest({ key, nonce: Date.now() });
	}, []);

	React.useEffect(() => {
		if (!focusRequest) return;
		const frame = requestAnimationFrame(() => {
			const container = document.querySelector<HTMLElement>(
				`[data-focus-key="${focusRequest.key}"]`,
			);
			container?.querySelector<HTMLInputElement>("input")?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [focusRequest]);

	const ownNames = React.useMemo(
		() =>
			new Set(parameters.map((p) => p.name).filter((n): n is string => !!n)),
		[parameters],
	);
	const inheritedOnly = React.useMemo(
		() => resolvedTree.inherited.filter((p) => !ownNames.has(p.name)),
		[resolvedTree.inherited, ownNames],
	);
	const conflictNames = React.useMemo(
		() => new Set(resolvedTree.conflicts.map((c) => c.name)),
		[resolvedTree.conflicts],
	);

	const tree: Record<string, TreeViewItem<ItemMeta>> = React.useMemo(() => {
		const dependsOnChildren = dependsOn.map(
			(_, i) => `_depends_on_${i}` as const,
		);
		const parameterChildren = parameters.map(
			(_, i) => `_parameter_${i}` as const,
		);
		const inheritedChildren = inheritedOnly.map(
			(_, i) => `_parameter_inherited_${i}` as const,
		);
		const out: Record<string, TreeViewItem<ItemMeta>> = {
			root: {
				name: "root",
				children: kindMeta.supportsParameters
					? ["_properties", "_depends_on", "_parameter", "_sql"]
					: ["_properties", "_depends_on", "_sql"],
			},
			_properties: {
				name: "_properties",
				meta: { type: "properties" },
				children: ["_url", "_title", "_description"],
			},
			_url: { name: "_url", meta: { type: "url" } },
			_title: { name: "_title", meta: { type: "title" } },
			_description: { name: "_description", meta: { type: "description" } },
			_depends_on: {
				name: "_depends_on",
				meta: { type: "depends-on" },
				children: [...dependsOnChildren, "_depends_on_add"],
			},
			_depends_on_add: {
				name: "_depends_on_add",
				meta: { type: "depends-on-add" },
			},
			_parameter: {
				name: "_parameter",
				meta: { type: "parameter" },
				children: [
					...inheritedChildren,
					...parameterChildren,
					"_parameter_add",
				],
			},
			_parameter_add: {
				name: "_parameter_add",
				meta: { type: "parameter-add" },
			},
			_sql: {
				name: "_sql",
				meta: { type: "sql" },
				children: ["_sql_value"],
			},
			_sql_value: { name: "_sql_value", meta: { type: "sql-value" } },
		};
		dependsOn.forEach((_, i) => {
			out[`_depends_on_${i}`] = {
				name: `_depends_on_${i}`,
				meta: { type: "depends-on-value", dependsOnIndex: i },
			};
		});
		parameters.forEach((_, i) => {
			out[`_parameter_${i}`] = {
				name: `_parameter_${i}`,
				meta: { type: "parameter-value", parameterIndex: i },
			};
		});
		inheritedOnly.forEach((_, i) => {
			out[`_parameter_inherited_${i}`] = {
				name: `_parameter_inherited_${i}`,
				meta: { type: "parameter-inherited", inheritedIndex: i },
			};
		});
		return out;
	}, [dependsOn, parameters, inheritedOnly, kindMeta.supportsParameters]);

	const [expandedItems, setExpandedItems] = React.useState<string[]>([
		"_properties",
		"_depends_on",
		"_parameter",
		"_sql",
	]);

	const updateTitle = (value: string) => {
		updateLibrary((lib) => ({ ...lib, title: value || undefined }));
	};
	const updateUrl = (value: string) => {
		updateLibrary((lib) => ({ ...lib, url: value || undefined }));
	};
	const updateDescription = (value: string) => {
		updateLibrary((lib) => ({ ...lib, description: value || undefined }));
	};

	const replaceDependsOn = (next: SQLDependsOn[]) => {
		updateLibrary((lib) => {
			const others = (lib.relatedArtifact ?? []).filter(
				(ra) => ra.type !== "depends-on",
			);
			const combined = [...others, ...next];
			return {
				...lib,
				relatedArtifact: combined.length > 0 ? combined : undefined,
			};
		});
	};

	const addDependsOn = () => {
		const newIndex = dependsOn.length;
		replaceDependsOn([
			...dependsOn,
			{ type: "depends-on", label: "", resource: "" },
		]);
		requestFocus(`depends-on-${newIndex}`);
	};

	const updateDependsOnLabel = (i: number, label: string) => {
		const next = dependsOn.slice();
		next[i] = { ...next[i], type: "depends-on", label };
		replaceDependsOn(next);
	};

	const updateDependsOnResource = (i: number, resource: string) => {
		const next = dependsOn.slice();
		next[i] = { ...next[i], type: "depends-on", resource };
		replaceDependsOn(next);
	};

	const removeDependsOn = (i: number) => {
		replaceDependsOn(dependsOn.filter((_, idx) => idx !== i));
	};

	const setParameters = (next: SQLParameter[]) => {
		updateLibrary((lib) => ({
			...lib,
			parameter: next.length > 0 ? next : undefined,
		}));
	};

	const addParameter = () => {
		const newIndex = parameters.length;
		setParameters([...parameters, { use: "in", name: "" }]);
		requestFocus(`parameter-${newIndex}`);
	};

	const updateParameterName = (i: number, name: string) => {
		const next = parameters.slice();
		next[i] = { ...next[i], use: "in", name };
		setParameters(next);
	};

	const updateParameterType = (i: number, type: string) => {
		const next = parameters.slice();
		next[i] = { ...next[i], use: "in", type };
		setParameters(next);
	};

	const removeParameter = (i: number) => {
		setParameters(parameters.filter((_, idx) => idx !== i));
	};

	const formatSqlContent = () => {
		const data = library.content?.[0]?.data;
		if (!data) return;
		let current: string;
		try {
			current = atob(data);
		} catch {
			return;
		}
		if (!current.trim()) return;
		let formatted: string;
		try {
			formatted = formatSQL(current, {
				language: "postgresql",
				indentStyle: "tabularRight",
			});
		} catch {
			return;
		}
		updateLibrary((lib) => {
			const existing = lib.content?.[0];
			return {
				...lib,
				content: [
					{
						contentType: existing?.contentType ?? "application/sql",
						data: btoa(formatted),
					},
				],
			};
		});
	};

	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const metaType = meta?.type;
		switch (metaType) {
			case "properties":
			case "depends-on":
			case "parameter":
				return <div>{labelView(item)}</div>;
			case "sql": {
				const hasSql = !!library.content?.[0]?.data;
				return (
					<div className="flex w-full items-center gap-1">
						{labelView(item)}
						<HSComp.Tooltip delayDuration={250}>
							<HSComp.TooltipTrigger asChild>
								<HSComp.Button
									variant="link"
									size="small"
									className="px-1 text-text-secondary hover:text-text-primary"
									onClick={(e) => {
										e.stopPropagation();
										formatSqlContent();
									}}
									onMouseDown={(e) => e.stopPropagation()}
									disabled={!hasSql}
									asChild
								>
									<span>
										<AlignLeft size={14} />
									</span>
								</HSComp.Button>
							</HSComp.TooltipTrigger>
							<HSComp.TooltipContent side="bottom">
								Format SQL
							</HSComp.TooltipContent>
						</HSComp.Tooltip>
					</div>
				);
			}
			case "url":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								name={`${kindMeta.kind}-library-url`}
								autoComplete="on"
								list={kindMeta.urlHistoryKey}
								placeholder="Canonical identifier for this library, represented as a URI (globally unique)"
								value={library.url}
								onChange={updateUrl}
							/>
						</div>
					</div>
				);
			case "title":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Name for this library (human friendly)"
								value={library.title}
								onChange={updateTitle}
							/>
						</div>
					</div>
				);
			case "description":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Natural language description of the library"
								value={library.description}
								onChange={updateDescription}
							/>
						</div>
					</div>
				);
			case "depends-on-value": {
				const idx = meta?.dependsOnIndex ?? -1;
				const entry = dependsOn[idx];
				if (!entry) return null;
				const labelValue = entry.label ?? "";
				const labelInvalid =
					labelValue.length > 0 && !LABEL_REGEX.test(labelValue);
				return (
					<div
						className="flex w-full items-center gap-2"
						data-focus-key={`depends-on-${idx}`}
					>
						<div className="w-[226px] shrink-0">
							<InputView
								placeholder="Table name"
								value={labelValue}
								onChange={(v) => updateDependsOnLabel(idx, v)}
								invalid={labelInvalid}
								className="font-mono text-xs"
							/>
						</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<ResourcePicker
								value={entry.resource}
								onChange={(ref) => updateDependsOnResource(idx, ref)}
								kinds={
									kindMeta.kind === "sql-view"
										? ["ViewDefinition", "SQLView"]
										: ["ViewDefinition", "SQLQuery", "SQLView"]
								}
							/>
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeDependsOn(idx)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "depends-on-add":
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={addDependsOn}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Depends on</span>
						</span>
					</HSComp.Button>
				);
			case "parameter-value": {
				const idx = meta?.parameterIndex ?? -1;
				const entry = parameters[idx];
				if (!entry) return null;
				return (
					<div
						className="flex w-full items-center gap-2"
						data-focus-key={`parameter-${idx}`}
					>
						<div className="w-[226px] shrink-0">
							<InputView
								placeholder="Name"
								value={entry.name ?? ""}
								onChange={(v) => updateParameterName(idx, v)}
								className="font-mono text-xs"
							/>
						</div>
						<div className="w-28 shrink-0">
							<HSComp.Select
								value={entry.type}
								onValueChange={(v) => updateParameterType(idx, v)}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="Type" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{FHIR_PARAMETER_TYPES.map((t) => (
										<HSComp.SelectItem key={t} value={t}>
											{t}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
						<ParamValueField
							name={entry.name}
							type={entry.type ?? "string"}
							value={entry.name ? (paramValues[entry.name] ?? "") : ""}
							onChange={(v) =>
								entry.name ? setParamValue(entry.name, v) : undefined
							}
							missing={
								!!entry.name &&
								missingParams.has(entry.name) &&
								(paramValues[entry.name] ?? "") === ""
							}
						/>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeParameter(idx)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "parameter-inherited": {
				const idx = meta?.inheritedIndex ?? -1;
				const entry = inheritedOnly[idx];
				if (!entry) return null;
				return (
					<InheritedParameterRow
						entry={entry}
						hasConflict={conflictNames.has(entry.name)}
						value={paramValues[entry.name] ?? ""}
						onValueChange={(v) => setParamValue(entry.name, v)}
						missing={
							missingParams.has(entry.name) &&
							(paramValues[entry.name] ?? "") === ""
						}
					/>
				);
			}
			case "parameter-add":
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={addParameter}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Parameter</span>
						</span>
					</HSComp.Button>
				);
			case "sql-value":
				return <SqlValueCell />;
			default:
				return <div>{labelView(item)}</div>;
		}
	};

	const urlHistory = readUrlHistory(kindMeta.urlHistoryKey);

	return (
		<div ref={treeContainerRef}>
			<datalist id={kindMeta.urlHistoryKey}>
				{urlHistory.map((u) => (
					<option key={u} value={u} />
				))}
			</datalist>
			<TreeView
				items={tree}
				rootItemId="root"
				customItemView={customItemView}
				disableHover={true}
				chevronClassName="self-center cursor-pointer"
				expandedItems={expandedItems}
				onExpandedItemsChange={setExpandedItems}
				onItemLabelClick={(item) => {
					if (item.isFolder()) {
						if (item.isExpanded()) item.collapse();
						else item.expand();
					}
				}}
				itemLabelClassFn={(item: ItemInstance<TreeViewItem<ItemMeta>>) => {
					const metaType = item.getItemData()?.meta?.type;
					if (
						metaType === "properties" ||
						metaType === "depends-on" ||
						metaType === "parameter" ||
						metaType === "sql"
					) {
						return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
					}
					return "pr-0";
				}}
			/>
		</div>
	);
}
