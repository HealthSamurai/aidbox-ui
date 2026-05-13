import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { AlertTriangle, Link, Plus, X } from "lucide-react";
import * as React from "react";
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
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	className?: string;
	invalid?: boolean;
	disabled?: boolean;
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

	return (
		<HSComp.Input
			disabled={disabled}
			className={`h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary disabled:cursor-not-allowed ${invalid ? "ring-1 ring-border-error rounded-md" : ""} ${className ?? ""}`}
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

	const isSectionFolder =
		metaType === "properties" ||
		metaType === "depends-on" ||
		metaType === "parameter" ||
		metaType === "sql";

	const additionalClass = isSectionFolder
		? "text-text-info-primary px-1!"
		: "text-text-info-primary bg-bg-info-primary";

	const onLabelClickFn = () => {
		if (!isFolder) return;
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

function InheritedParameterRow({
	entry,
	hasConflict,
}: {
	entry: ResolvedParameter;
	hasConflict: boolean;
}) {
	return (
		<div className="flex w-full items-center gap-2">
			<div className="w-44 shrink-0 cursor-not-allowed">
				<InputView
					disabled
					placeholder="name"
					value={entry.name}
					className="font-mono text-xs"
				/>
			</div>
			<div className="w-36 cursor-not-allowed">
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
			<InheritedSourceTooltip
				sources={entry.sources}
				hasConflict={hasConflict}
			/>
		</div>
	);
}

function InheritedSourceTooltip({
	sources,
	hasConflict,
}: {
	sources: ResolvedParameter["sources"];
	hasConflict: boolean;
}) {
	return (
		<HSComp.Tooltip delayDuration={250}>
			<HSComp.TooltipTrigger asChild>
				<span
					className={`inline-flex items-center justify-center w-6 h-6 rounded ${
						hasConflict ? "text-text-error-primary" : "text-text-link"
					}`}
				>
					{hasConflict ? <AlertTriangle size={14} /> : <Link size={14} />}
				</span>
			</HSComp.TooltipTrigger>
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
							<span className="typo-label-tiny text-text-tertiary">
								SQLQuery
							</span>
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
		</HSComp.Tooltip>
	);
}

export function PropertiesTree() {
	const { library, updateLibrary } = useSQLQueryContext();

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
				children: ["_properties", "_depends_on", "_parameter", "_sql"],
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
	}, [dependsOn, parameters, inheritedOnly]);

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
		setParameters([...parameters, { use: "in", name: "", type: "string" }]);
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

	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const metaType = meta?.type;
		switch (metaType) {
			case "properties":
			case "depends-on":
			case "parameter":
			case "sql":
				return <div>{labelView(item)}</div>;
			case "url":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-44 shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
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
						<div className="w-44 shrink-0">{labelView(item)}</div>
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
						<div className="w-44 shrink-0">{labelView(item)}</div>
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
						<div className="w-44 shrink-0">
							<InputView
								placeholder="label"
								value={labelValue}
								onChange={(v) => updateDependsOnLabel(idx, v)}
								invalid={labelInvalid}
								className="font-mono text-xs"
							/>
						</div>
						<div className="flex-1 min-w-0">
							<ResourcePicker
								value={entry.resource}
								onChange={(ref) => updateDependsOnResource(idx, ref)}
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
						<div className="w-44 shrink-0">
							<InputView
								placeholder="name"
								value={entry.name ?? ""}
								onChange={(v) => updateParameterName(idx, v)}
								className="font-mono text-xs"
							/>
						</div>
						<div className="w-36">
							<HSComp.Select
								value={entry.type ?? "string"}
								onValueChange={(v) => updateParameterType(idx, v)}
							>
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
						<HSComp.Button
							variant="link"
							size="small"
							className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
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
				return (
					<div
						className="w-full h-[400px] -ml-2.5"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="presentation"
					>
						<SqlEditor />
					</div>
				);
			default:
				return <div>{labelView(item)}</div>;
		}
	};

	return (
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
	);
}
