import * as HSComp from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { Database, ExternalLink, FileCode2, Table, X } from "lucide-react";
import type { LineageNodeData, ViewSelect } from "./types";

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

function FhirPath({ value }: { value: string }) {
	return (
		<code className="font-mono text-xs text-text-link break-all">{value}</code>
	);
}

function SelectTree({ node }: { node: ViewSelect }) {
	return (
		<div className="flex flex-col gap-1.5 border-l-2 border-border-secondary pl-3">
			{node.forEach && (
				<div className="flex flex-col gap-0.5">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						forEach
					</span>
					<FhirPath value={node.forEach} />
				</div>
			)}
			{node.forEachOrNull && (
				<div className="flex flex-col gap-0.5">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						forEachOrNull
					</span>
					<FhirPath value={node.forEachOrNull} />
				</div>
			)}
			{node.repeat && (
				<div className="flex flex-col gap-0.5">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						repeat
					</span>
					<FhirPath value={node.repeat} />
				</div>
			)}
			{node.where && node.where.length > 0 && (
				<div className="flex flex-col gap-0.5">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						where
					</span>
					{node.where.map((w) => (
						<FhirPath key={w.path} value={w.path} />
					))}
				</div>
			)}
			{node.column && node.column.length > 0 && (
				<div className="flex flex-col gap-0.5">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						column
					</span>
					<div className="flex flex-col gap-2">
						{node.column.map((c) => (
							<div key={c.name} className="flex flex-col gap-0.5">
								<span className="text-text-primary text-xs font-mono">
									{c.name}
									{c.collection ? "[]" : ""}
								</span>
								{c.path && <FhirPath value={c.path} />}
							</div>
						))}
					</div>
				</div>
			)}
			{node.unionAll && node.unionAll.length > 0 && (
				<div className="flex flex-col gap-1">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						unionAll
					</span>
					{node.unionAll.map((child, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: order is stable
						<SelectTree key={i} node={child} />
					))}
				</div>
			)}
			{node.select && node.select.length > 0 && (
				<div className="flex flex-col gap-1">
					<span className="typo-label-tiny text-text-tertiary uppercase">
						select
					</span>
					{node.select.map((child, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: order is stable
						<SelectTree key={i} node={child} />
					))}
				</div>
			)}
		</div>
	);
}

export function LineageDetailPanel({
	data,
	onClose,
}: {
	data: LineageNodeData;
	onClose: () => void;
}) {
	if (data.kind === "resource-type") {
		return (
			<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
				<PanelHeader
					icon={<Database size={14} />}
					label="Resource"
					color="text-text-success-primary"
					onClose={onClose}
				/>
				<Field label="Resource type" value={data.resourceType} mono copyable />
				<Link
					to="/resource/$resourceType"
					params={{ resourceType: data.resourceType }}
					className="inline-flex items-center gap-1 text-text-link hover:underline text-sm w-fit"
				>
					<ExternalLink size={14} />
					Open in Resource Browser
				</Link>
			</div>
		);
	}

	if (data.kind === "view-definition") {
		return (
			<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
				<PanelHeader
					icon={<Table size={14} />}
					label="View"
					color="text-text-info-primary"
					onClose={onClose}
				/>
				<div className="flex flex-col gap-1">
					<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
						ID
					</span>
					<Link
						to="/data-lineage/views/edit/$id"
						params={{ id: data.id }}
						search={{
							tab: "builder" as const,
							mode: "json" as const,
							builderTab: "form" as const,
						}}
						className="text-sm font-mono text-text-link hover:underline break-all"
					>
						{data.id}
					</Link>
				</div>
				<Field label="Title" value={data.title || data.name || data.id} />
				{data.name && <Field label="Name" value={data.name} mono copyable />}
				{data.canonical && (
					<Field label="Canonical URL" value={data.canonical} mono copyable />
				)}
				{data.resourceType && (
					<Field label="FHIR resource" value={data.resourceType} mono />
				)}
				{data.description && (
					<Section title="Description">
						<p className="text-sm text-text-secondary whitespace-pre-wrap">
							{data.description}
						</p>
					</Section>
				)}
				{data.constants.length > 0 && (
					<Section title="Constants">
						<ul className="list-disc pl-4 flex flex-col gap-0.5">
							{data.constants.map((c) => (
								<li key={c.name} className="text-xs font-mono break-all">
									<span className="text-text-link">%{c.name}</span>
									<span className="text-text-tertiary"> ({c.type})</span>
									<span className="text-text-primary"> = {c.value}</span>
								</li>
							))}
						</ul>
					</Section>
				)}
				{data.where.length > 0 && (
					<Section title="Where">
						<div className="flex flex-col gap-1">
							{data.where.map((w) => (
								<FhirPath key={w.path} value={w.path} />
							))}
						</div>
					</Section>
				)}
				<Section title="Select">
					{data.select.length === 0 ? (
						<span className="text-xs text-text-tertiary italic">no select</span>
					) : (
						<div className="flex flex-col gap-2">
							{data.select.map((s, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: order is stable
								<SelectTree key={i} node={s} />
							))}
						</div>
					)}
				</Section>
			</div>
		);
	}

	// sql-query
	return (
		<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
			<PanelHeader
				icon={<FileCode2 size={14} />}
				label="Query"
				color="text-text-brand-primary"
				onClose={onClose}
			/>
			<div className="flex flex-col gap-1">
				<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
					ID
				</span>
				<Link
					to="/data-lineage/queries/edit/$id"
					params={{ id: data.id }}
					search={{
						tab: "sqlquery" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					}}
					className="text-sm font-mono text-text-link hover:underline break-all"
				>
					{data.id}
				</Link>
			</div>
			<Field label="Title" value={data.title || data.name || data.id} />
			{data.name && <Field label="Name" value={data.name} mono copyable />}
			{data.canonical && (
				<Field label="Canonical URL" value={data.canonical} mono copyable />
			)}
			{data.description && (
				<Section title="Description">
					<p className="text-sm text-text-secondary whitespace-pre-wrap">
						{data.description}
					</p>
				</Section>
			)}
			<Section title={`Parameters (${data.parameters.length})`}>
				{data.parameters.length === 0 ? (
					<span className="text-xs text-text-tertiary italic">none</span>
				) : (
					<ul className="list-disc pl-4 flex flex-col gap-0.5">
						{data.parameters.map((p) => (
							<li key={p.name} className="text-xs font-mono">
								<span className="text-text-primary">{p.name}</span>
								{p.type && (
									<span className="text-text-tertiary"> ({p.type})</span>
								)}
							</li>
						))}
					</ul>
				)}
			</Section>
		</div>
	);
}
