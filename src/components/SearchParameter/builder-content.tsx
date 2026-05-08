import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import { useDebounce } from "../../hooks";
import { FhirPathInput } from "../ViewDefinition/fhirpath-input";
import { FhirPathLspProvider } from "../ViewDefinition/fhirpath-lsp-context";
import { QueryRunner } from "./query-runner";

type SearchParameterStatus = "draft" | "active" | "retired" | "unknown";
type SearchParameterType =
	| "number"
	| "date"
	| "string"
	| "token"
	| "reference"
	| "composite"
	| "quantity"
	| "uri"
	| "special";
type XPathUsage = "normal" | "phonetic" | "nearby" | "distance" | "other";

type SearchParameterResource = Resource & {
	code?: string;
	base?: string[];
	name?: string;
	description?: string;
	status?: SearchParameterStatus;
	type?: SearchParameterType;
	url?: string;
	expression?: string;
	target?: string[];
	version?: string;
	experimental?: boolean;
	xpath?: string;
	xpathUsage?: XPathUsage;
};

const STATUS_OPTIONS: SearchParameterStatus[] = [
	"draft",
	"active",
	"retired",
	"unknown",
];

const TYPE_OPTIONS: SearchParameterType[] = [
	"string",
	"token",
	"reference",
	"date",
	"number",
	"quantity",
	"uri",
	"composite",
	"special",
];

const XPATH_USAGE_OPTIONS: XPathUsage[] = [
	"normal",
	"phonetic",
	"nearby",
	"distance",
	"other",
];

const splitTokens = (s: string): string[] =>
	s
		.split(/[\s,]+/)
		.map((x) => x.trim())
		.filter(Boolean);

/** Debounced single-line input, styled to match VD's `InputView`. */
const InlineInput = ({
	id,
	value,
	placeholder,
	onChange,
	className,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	onChange: (v: string) => void;
	className?: string;
}) => {
	const [localValue, setLocalValue] = useState(value || "");
	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);
	const debouncedOnChange = useDebounce((newValue: string) => {
		if (newValue !== value) onChange(newValue);
	}, 400);
	return (
		<HSComp.Input
			id={id}
			value={localValue}
			placeholder={placeholder}
			className={`h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary ${className ?? ""}`}
			onChange={(e) => {
				setLocalValue(e.target.value);
				debouncedOnChange(e.target.value);
			}}
		/>
	);
};

/** Debounced multi-line input, same color treatment as InlineInput. */
const InlineTextarea = ({
	id,
	value,
	placeholder,
	onChange,
	rows = 2,
	className,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	onChange: (v: string) => void;
	rows?: number;
	className?: string;
}) => {
	const [localValue, setLocalValue] = useState(value || "");
	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);
	const debouncedOnChange = useDebounce((newValue: string) => {
		if (newValue !== value) onChange(newValue);
	}, 400);
	return (
		<HSComp.Textarea
			id={id}
			value={localValue}
			rows={rows}
			placeholder={placeholder}
			className={`py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary ${className ?? ""}`}
			onChange={(e) => {
				setLocalValue(e.target.value);
				debouncedOnChange(e.target.value);
			}}
		/>
	);
};

const InlineSelect = <T extends string>({
	value,
	options,
	placeholder,
	onChange,
}: {
	value?: T;
	options: readonly T[];
	placeholder: string;
	onChange: (v: T) => void;
}) => (
	<HSComp.Select value={value ?? ""} onValueChange={(v) => onChange(v as T)}>
		<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary w-full">
			<HSComp.SelectValue placeholder={placeholder} />
		</HSComp.SelectTrigger>
		<HSComp.SelectContent>
			{options.map((opt) => (
				<HSComp.SelectItem key={opt} value={opt}>
					{opt}
				</HSComp.SelectItem>
			))}
		</HSComp.SelectContent>
	</HSComp.Select>
);

type SpItemType =
	| "properties"
	| "definition"
	| "optional"
	| "url"
	| "name"
	| "code"
	| "status"
	| "description"
	| "type"
	| "base"
	| "expression"
	| "target"
	| "version"
	| "experimental"
	| "xpath"
	| "xpath-usage";

interface SpItemMeta {
	type: SpItemType;
}

const FOLDER_TYPES = new Set<SpItemType>([
	"properties",
	"definition",
	"optional",
]);

const BuilderTab = ({
	resource,
	onResourceChange,
}: {
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
}) => {
	const sp = resource as SearchParameterResource;
	const update = (patch: Partial<SearchParameterResource>) => {
		if (!onResourceChange) return;
		// Strip keys whose new value is "" / undefined / [] so the JSON stays clean.
		const next: Record<string, unknown> = {
			...(resource as unknown as Record<string, unknown>),
			...patch,
		};
		for (const [k, v] of Object.entries(patch)) {
			if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
				delete next[k];
			}
		}
		onResourceChange(next as unknown as Resource);
	};

	const isReference = sp.type === "reference";
	// SearchParameter expressions are conventionally fully-qualified
	// (`Patient.name`, not `name`). If we set the LSP context to the resource
	// type, completion treats `Patient.name` as `Patient.Patient.name` and
	// flags it. Run the LSP at the FHIR root instead.
	const fhirPathContext = "";

	const tree = useMemo<Record<string, TreeViewItem<SpItemMeta>>>(() => {
		const definitionChildren = ["_type", "_base", "_expression"];
		if (isReference) definitionChildren.push("_target");
		return {
			root: {
				name: "root",
				children: ["_properties", "_definition", "_optional"],
			},
			_properties: {
				name: "_properties",
				meta: { type: "properties" },
				children: ["_url", "_name", "_code", "_status", "_description"],
			},
			_url: { name: "_url", meta: { type: "url" } },
			_name: { name: "_name", meta: { type: "name" } },
			_code: { name: "_code", meta: { type: "code" } },
			_status: { name: "_status", meta: { type: "status" } },
			_description: { name: "_description", meta: { type: "description" } },
			_definition: {
				name: "_definition",
				meta: { type: "definition" },
				children: definitionChildren,
			},
			_type: { name: "_type", meta: { type: "type" } },
			_base: { name: "_base", meta: { type: "base" } },
			_expression: { name: "_expression", meta: { type: "expression" } },
			_target: { name: "_target", meta: { type: "target" } },
			_optional: {
				name: "_optional",
				meta: { type: "optional" },
				children: ["_version", "_experimental", "_xpath", "_xpath_usage"],
			},
			_version: { name: "_version", meta: { type: "version" } },
			_experimental: { name: "_experimental", meta: { type: "experimental" } },
			_xpath: { name: "_xpath", meta: { type: "xpath" } },
			_xpath_usage: { name: "_xpath_usage", meta: { type: "xpath-usage" } },
		};
	}, [isReference]);

	const [collapsedItemIds, setCollapsedItemIds] = useState<string[]>([
		"_optional",
	]);
	const expandedItems = useMemo(
		() =>
			Object.keys(tree).filter(
				(id) => id !== "root" && !collapsedItemIds.includes(id),
			),
		[tree, collapsedItemIds],
	);
	const onExpandedItemsChange = (items: string[]) => {
		const allIds = Object.keys(tree).filter((id) => id !== "root");
		setCollapsedItemIds(allIds.filter((id) => !items.includes(id)));
	};

	const labelView = (item: ItemInstance<TreeViewItem<SpItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const t = meta?.type;
		const isFolder = t ? FOLDER_TYPES.has(t) : false;
		const label =
			t === "xpath-usage" ? "xpath usage" : (t as string | undefined);
		const cls = isFolder
			? "text-text-info-primary px-1!"
			: "text-text-info-primary bg-bg-info-primary";
		return (
			<button
				type="button"
				className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${cls}`}
				onClick={() => {
					if (!isFolder) return;
					if (item.isExpanded()) item.collapse();
					else item.expand();
				}}
			>
				{label}
			</button>
		);
	};

	const renderEditorRow = (
		item: ItemInstance<TreeViewItem<SpItemMeta>>,
		editor: React.ReactNode,
	) => (
		<div className="flex w-full items-center justify-between gap-2">
			{labelView(item)}
			<div className="w-[60%] min-w-0">{editor}</div>
		</div>
	);

	const customItemView = (item: ItemInstance<TreeViewItem<SpItemMeta>>) => {
		const t = item.getItemData()?.meta?.type;
		switch (t) {
			case "properties":
			case "definition":
			case "optional":
				return <div>{labelView(item)}</div>;
			case "url":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-url"
						value={sp.url}
						placeholder="http://example.org/SearchParameter/Patient-name"
						onChange={(v) => update({ url: v })}
					/>,
				);
			case "name":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-name"
						value={sp.name}
						placeholder="name"
						onChange={(v) => update({ name: v })}
					/>,
				);
			case "code":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-code"
						value={sp.code}
						placeholder="name"
						onChange={(v) => update({ code: v })}
					/>,
				);
			case "status":
				return renderEditorRow(
					item,
					<InlineSelect
						value={sp.status}
						options={STATUS_OPTIONS}
						placeholder="Pick status"
						onChange={(v) => update({ status: v })}
					/>,
				);
			case "description":
				return renderEditorRow(
					item,
					<InlineTextarea
						id="sp-description"
						value={sp.description}
						placeholder="What this search parameter does."
						rows={3}
						onChange={(v) => update({ description: v })}
					/>,
				);
			case "type":
				return renderEditorRow(
					item,
					<InlineSelect
						value={sp.type}
						options={TYPE_OPTIONS}
						placeholder="Pick type"
						onChange={(v) => update({ type: v })}
					/>,
				);
			case "base":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-base"
						value={(sp.base ?? []).join(", ")}
						placeholder="Patient, Practitioner"
						onChange={(v) => update({ base: splitTokens(v) })}
					/>,
				);
			case "expression":
				return renderEditorRow(
					item,
					<FhirPathInput
						id="sp-expression"
						value={sp.expression}
						placeholder={sp.base?.[0] ? `${sp.base[0]}.name` : "Patient.name"}
						contextPath={fhirPathContext}
						onChange={(v) => update({ expression: v })}
					/>,
				);
			case "target":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-target"
						value={(sp.target ?? []).join(", ")}
						placeholder="Patient, Group"
						onChange={(v) => update({ target: splitTokens(v) })}
					/>,
				);
			case "version":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-version"
						value={sp.version}
						placeholder="1.0.0"
						onChange={(v) => update({ version: v })}
					/>,
				);
			case "experimental":
				return renderEditorRow(
					item,
					<div className="flex items-center h-7">
						<HSComp.Checkbox
							id="sp-experimental"
							checked={Boolean(sp.experimental)}
							onCheckedChange={(v) => update({ experimental: v === true })}
						/>
					</div>,
				);
			case "xpath":
				return renderEditorRow(
					item,
					<InlineInput
						id="sp-xpath"
						value={sp.xpath}
						placeholder="f:Patient/f:name"
						onChange={(v) => update({ xpath: v })}
					/>,
				);
			case "xpath-usage":
				return renderEditorRow(
					item,
					<InlineSelect
						value={sp.xpathUsage}
						options={XPATH_USAGE_OPTIONS}
						placeholder="(none)"
						onChange={(v) => update({ xpathUsage: v })}
					/>,
				);
			default:
				return <div>{labelView(item)}</div>;
		}
	};

	return (
		<FhirPathLspProvider resourceType={fhirPathContext || undefined}>
			<div className="p-4 w-full">
				{!onResourceChange && (
					<div className="text-xs text-text-tertiary px-2 pb-2">
						Editing disabled — no resource setter is wired.
					</div>
				)}
				<TreeView
					itemLabelClassFn={(item) => {
						const t = item.getItemData()?.meta?.type;
						if (t && FOLDER_TYPES.has(t)) {
							return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
						}
						return "pr-0";
					}}
					items={tree}
					rootItemId="root"
					customItemView={customItemView}
					disableHover={true}
					chevronClassName="self-center cursor-pointer"
					onItemLabelClick={(item) => {
						if (item.isFolder()) {
							if (item.isExpanded()) item.collapse();
							else item.expand();
						}
					}}
					canReorder={false}
					expandedItems={expandedItems}
					onExpandedItemsChange={onExpandedItemsChange}
				/>
			</div>
		</FhirPathLspProvider>
	);
};

export const SearchParameterBuilderContent = ({
	client,
	resource,
	onResourceChange,
	actions,
}: {
	client: AidboxClientR5;
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
	/**
	 * Toolbar slot rendered at the top of the left pane — typically the
	 * `<SaveButton/> <DeleteButton/>` pair from `ResourceEditor`. Mirrors
	 * VD's `editor-panel-content` top bar.
	 */
	actions?: React.ReactNode;
}) => {
	const sp = resource as SearchParameterResource;
	const [isQueryToolOpen, setIsQueryToolOpen] = useState(true);
	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="search-parameter-builder"
			className="grow min-h-0"
		>
			<HSComp.ResizablePanel minSize={30} className="flex flex-col">
				{(actions || !isQueryToolOpen) && (
					<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
						<div className="flex items-center gap-4 px-4 grow">{actions}</div>
						{!isQueryToolOpen && (
							<div className="flex items-center px-2">
								<HSComp.Toggle
									variant="outline"
									pressed={isQueryToolOpen}
									onPressedChange={setIsQueryToolOpen}
								>
									<Lucide.PanelRightIcon className="w-4 h-4" />
									Query tool
								</HSComp.Toggle>
							</div>
						)}
					</div>
				)}
				<div className="grow min-h-0 overflow-auto">
					<BuilderTab resource={resource} onResourceChange={onResourceChange} />
				</div>
			</HSComp.ResizablePanel>
			{isQueryToolOpen && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel minSize={20} defaultSize={50}>
						<QueryRunner
							client={client}
							base={sp.base?.[0]}
							code={sp.code}
							onClose={() => setIsQueryToolOpen(false)}
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
};
