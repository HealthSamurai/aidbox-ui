import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { ResourcePicker } from "../SQLQueryBuilder/resource-picker";
import {
	IDENTIFIER_REGEX,
	type MaterializationResource,
	OBJECT_TYPES,
	parameterValue,
	profileOf,
	TARGET_TYPES,
	type TargetType,
	targetTypeOf,
	withDefaultProfile,
	withParameter,
	withProfile,
} from "./types";

type ItemMeta = {
	type:
		| "properties"
		| "parameters"
		| "profile"
		| "target"
		| "target-type"
		| "schema"
		| "name"
		| "materialization-type";
};

/** The profiles constraining this resource — one per storage kind. */
function useMaterializationProfiles() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["aidbox-materialization-profiles"],
		queryFn: async () => {
			const result = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/StructureDefinition",
				params: [
					["type", "AidboxMaterialization"],
					["derivation", "constraint"],
					["_count", "100"],
				],
			});
			if (!result.isOk()) return [];
			return (result.value.resource.entry ?? []).flatMap((entry) => {
				const sd = entry.resource as {
					url?: string;
					title?: string;
					name?: string;
				};
				return sd.url
					? [{ url: sd.url, label: sd.title ?? sd.name ?? sd.url }]
					: [];
			});
		},
	});
}

function InputView({
	placeholder,
	value,
	onChange,
	className,
	invalid,
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	className?: string;
	invalid?: boolean;
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

	const ringCls = invalid
		? "ring-1 ring-border-error rounded-md focus:ring-border-error"
		: "focus:ring-1 focus:ring-border-link";
	return (
		<HSComp.Input
			className={`h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary ${ringCls} ${className ?? ""}`}
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
		metaType === "properties" || metaType === "parameters";

	const additionalClass = isSectionFolder
		? "text-text-info-primary px-1!"
		: "text-text-info-primary bg-bg-info-primary";

	return (
		<button
			type="button"
			className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
			onClick={(e) => {
				if (!isFolder) return;
				e.stopPropagation();
				if (item.isExpanded()) item.collapse();
				else item.expand();
			}}
		>
			{metaType === "parameters"
				? "Parameters"
				: metaType === "materialization-type"
					? "materializationType"
					: metaType === "target-type"
						? "type"
						: metaType}
		</button>
	);
}

export function PropertiesTree({
	resource,
	onResourceChange,
}: {
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
}) {
	const materialization = resource as MaterializationResource;
	const [expandedItems, setExpandedItems] = React.useState<string[]>([
		"_properties",
		"_parameters",
	]);

	const { data: profiles = [] } = useMaterializationProfiles();
	const profile = profileOf(materialization);

	const update = (next: MaterializationResource) =>
		onResourceChange?.(withDefaultProfile(next) as Resource);

	const schema = parameterValue(materialization, "schema");
	const name = parameterValue(materialization, "name");
	const objectType = parameterValue(materialization, "materializationType");

	const tree: Record<string, TreeViewItem<ItemMeta>> = {
		root: { name: "root", children: ["_properties", "_parameters"] },
		_properties: {
			name: "_properties",
			meta: { type: "properties" },
			children: ["_profile", "_target", "_target_type"],
		},
		// The profile slices `parameter` and closes it, so the set is fixed.
		_parameters: {
			name: "_parameters",
			meta: { type: "parameters" },
			children: ["_schema", "_name", "_object_type"],
		},
		_profile: { name: "_profile", meta: { type: "profile" } },
		_target: { name: "_target", meta: { type: "target" } },
		_target_type: { name: "_target_type", meta: { type: "target-type" } },
		_schema: { name: "_schema", meta: { type: "schema" } },
		_name: { name: "_name", meta: { type: "name" } },
		_object_type: {
			name: "_object_type",
			meta: { type: "materialization-type" },
		},
	};

	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		switch (item.getItemData()?.meta?.type) {
			case "profile":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<HSComp.Select
								value={profile ?? ""}
								onValueChange={(v) => update(withProfile(materialization, v))}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="Storage the target is materialized into" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{profiles.map((p) => (
										<HSComp.SelectItem key={p.url} value={p.url}>
											{p.label}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			case "target":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<ResourcePicker
								value={materialization.target}
								placeholder="Canonical URL of the view or query to materialize"
								kinds={["ViewDefinition", "SQLView", "SQLQuery"]}
								onChange={(reference, kind) =>
									update({
										...materialization,
										target: reference,
										type: targetTypeOf(kind),
									})
								}
							/>
						</div>
					</div>
				);
			case "target-type":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<HSComp.Select
								value={materialization.type ?? ""}
								onValueChange={(v) =>
									update({ ...materialization, type: v as TargetType })
								}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="type" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{TARGET_TYPES.map((t) => (
										<HSComp.SelectItem key={t} value={t}>
											{t}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			case "schema":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<InputView
								placeholder="sof"
								value={schema}
								invalid={
									Boolean(schema) && !IDENTIFIER_REGEX.test(schema ?? "")
								}
								className="font-mono text-xs"
								onChange={(v) =>
									update(
										withParameter(materialization, "schema", v, "valueString"),
									)
								}
							/>
						</div>
					</div>
				);
			case "name":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<InputView
								placeholder="Object name dependents read from"
								value={name}
								invalid={Boolean(name) && !IDENTIFIER_REGEX.test(name ?? "")}
								className="font-mono text-xs"
								onChange={(v) =>
									update(
										withParameter(materialization, "name", v, "valueString"),
									)
								}
							/>
						</div>
					</div>
				);
			case "materialization-type":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0 max-w-[500px]">
							<HSComp.Select
								value={objectType ?? ""}
								onValueChange={(v) =>
									update(
										withParameter(
											materialization,
											"materializationType",
											v,
											"valueCode",
										),
									)
								}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="view" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{OBJECT_TYPES.map((t) => (
										<HSComp.SelectItem key={t} value={t}>
											{t}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
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
			itemLabelClassFn={(item: ItemInstance<TreeViewItem<ItemMeta>>) =>
				item.getItemData()?.meta?.type === "properties" ||
				item.getItemData()?.meta?.type === "parameters"
					? "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5"
					: "pr-0"
			}
		/>
	);
}
