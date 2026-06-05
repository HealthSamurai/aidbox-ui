import * as HSComp from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Database, ListTree, X } from "lucide-react";
import type * as React from "react";
import type {
	CodeSystemNodeData,
	GraphNodeData,
	UnresolvedNodeData,
	ValueSetNodeData,
} from "./types";

function CloseButton({ onClose }: { onClose: () => void }) {
	return (
		<HSComp.IconButton
			variant="ghost"
			aria-label="Close"
			onClick={onClose}
			icon={<X className="w-4 h-4" />}
		/>
	);
}

function PanelHeader({
	icon,
	label,
	color,
	onClose,
}: {
	icon: React.ReactNode;
	label: string;
	color: string;
	onClose: () => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<div className={`flex items-center gap-2 ${color}`}>
				{icon}
				<span className="font-mono text-xs uppercase">{label}</span>
			</div>
			<CloseButton onClose={onClose} />
		</div>
	);
}

function Field({
	label,
	value,
	mono,
	copyable,
}: {
	label: string;
	value: string;
	mono?: boolean;
	copyable?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
				{label}
			</span>
			<div className="flex items-center gap-1 group/field">
				<span
					className={`text-sm ${mono ? "font-mono" : ""} text-text-primary break-all`}
				>
					{value}
				</span>
				{copyable && (
					<span className="opacity-0 group-hover/field:opacity-100 transition-opacity [&_svg]:size-3.5 text-text-tertiary hover:text-text-primary">
						<HSComp.CopyIcon
							text={value}
							tooltipText="Copy"
							showToast={false}
						/>
					</span>
				)}
			</div>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
				{title}
			</span>
			{children}
		</div>
	);
}

function ResourceLink({
	resourceType,
	id,
}: {
	resourceType: "ValueSet" | "CodeSystem";
	id: string;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
				ID
			</span>
			<Link
				to="/resource/$resourceType/edit/$id"
				params={{ resourceType, id }}
				search={{
					tab: "builder" as const,
					mode: "json" as const,
					builderTab: "form" as const,
				}}
				className="text-sm font-mono text-text-link hover:underline break-all"
			>
				{id}
			</Link>
		</div>
	);
}

function ValueSetContent({
	data,
	onClose,
}: {
	data: ValueSetNodeData;
	onClose: () => void;
}) {
	const totalIncludes = data.includeSystems + data.includeValueSets;
	const totalExcludes = data.excludeSystems + data.excludeValueSets;
	return (
		<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
			<PanelHeader
				icon={<ListTree size={14} />}
				label={data.isRoot ? "ValueSet (root)" : "ValueSet"}
				color="text-text-info-primary"
				onClose={onClose}
			/>
			{data.id && <ResourceLink resourceType="ValueSet" id={data.id} />}
			<Field
				label="Title"
				value={data.title || data.name || data.id || "(unnamed)"}
			/>
			{data.name && <Field label="Name" value={data.name} mono copyable />}
			{data.url && (
				<Field label="Canonical URL" value={data.url} mono copyable />
			)}
			{data.version && <Field label="Version" value={data.version} mono />}
			{data.status && <Field label="Status" value={data.status} mono />}
			{data.description && (
				<Section title="Description">
					<p className="text-sm text-text-primary whitespace-pre-wrap break-words">
						{data.description}
					</p>
				</Section>
			)}
			{totalIncludes > 0 && (
				<Section title="Compose includes">
					<ul className="list-disc pl-4 flex flex-col gap-0.5">
						{data.includeSystems > 0 && (
							<li className="text-xs font-mono">
								<span className="text-text-primary">{data.includeSystems}</span>
								<span className="text-text-tertiary"> CodeSystem(s)</span>
							</li>
						)}
						{data.includeValueSets > 0 && (
							<li className="text-xs font-mono">
								<span className="text-text-primary">
									{data.includeValueSets}
								</span>
								<span className="text-text-tertiary"> ValueSet(s)</span>
							</li>
						)}
					</ul>
				</Section>
			)}
			{totalExcludes > 0 && (
				<Section title="Compose excludes">
					<ul className="list-disc pl-4 flex flex-col gap-0.5">
						{data.excludeSystems > 0 && (
							<li className="text-xs font-mono">
								<span className="text-text-primary">{data.excludeSystems}</span>
								<span className="text-text-tertiary"> CodeSystem(s)</span>
							</li>
						)}
						{data.excludeValueSets > 0 && (
							<li className="text-xs font-mono">
								<span className="text-text-primary">
									{data.excludeValueSets}
								</span>
								<span className="text-text-tertiary"> ValueSet(s)</span>
							</li>
						)}
					</ul>
				</Section>
			)}
		</div>
	);
}

function CodeSystemContent({
	data,
	onClose,
}: {
	data: CodeSystemNodeData;
	onClose: () => void;
}) {
	return (
		<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
			<PanelHeader
				icon={<Database size={14} />}
				label="CodeSystem"
				color="text-text-success-primary"
				onClose={onClose}
			/>
			{data.id && <ResourceLink resourceType="CodeSystem" id={data.id} />}
			<Field
				label="Title"
				value={data.title || data.name || data.id || "(unnamed)"}
			/>
			{data.name && <Field label="Name" value={data.name} mono copyable />}
			{data.url && (
				<Field label="Canonical URL" value={data.url} mono copyable />
			)}
			{data.version && <Field label="Version" value={data.version} mono />}
			{data.content && <Field label="Content" value={data.content} mono />}
			{data.status && <Field label="Status" value={data.status} mono />}
			{typeof data.count === "number" && (
				<Field label="Concept count" value={data.count.toLocaleString()} mono />
			)}
			{data.description && (
				<Section title="Description">
					<p className="text-sm text-text-primary whitespace-pre-wrap break-words">
						{data.description}
					</p>
				</Section>
			)}
		</div>
	);
}

function UnresolvedContent({
	data,
	onClose,
}: {
	data: UnresolvedNodeData;
	onClose: () => void;
}) {
	const color =
		data.resourceKind === "ValueSet"
			? "text-text-info-primary"
			: "text-text-success-primary";
	return (
		<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
			<PanelHeader
				icon={<AlertCircle size={14} />}
				label={`${data.resourceKind} (unresolved)`}
				color={color}
				onClose={onClose}
			/>
			<Field label="Canonical URL" value={data.url} mono copyable />
			{data.version && <Field label="Version" value={data.version} mono />}
			<p className="text-xs text-text-tertiary">
				This {data.resourceKind} is referenced by another resource but is not
				present in the Aidbox database.
			</p>
		</div>
	);
}

export function GraphDetailPanel({
	data,
	onClose,
}: {
	data: GraphNodeData;
	onClose: () => void;
}) {
	if (data.kind === "value-set") {
		return <ValueSetContent data={data} onClose={onClose} />;
	}
	if (data.kind === "code-system") {
		return <CodeSystemContent data={data} onClose={onClose} />;
	}
	return <UnresolvedContent data={data} onClose={onClose} />;
}
