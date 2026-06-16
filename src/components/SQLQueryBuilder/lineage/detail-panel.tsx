import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Database,
	ExternalLink,
	FileCode2,
	Layers,
	Table,
	X,
} from "lucide-react";
import type * as React from "react";
import { useAidboxClient } from "../../../AidboxClient";
import {
	extractIndexType,
	fetchTableDetails,
	formatColumnType,
	formatRowCount,
	type TableDetails,
} from "../../db-console/tables-view";
import type {
	LineageNodeData,
	ResourceTypeNodeData,
	ViewSelect,
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

function FhirPath({ value }: { value: string }) {
	return (
		<code className="font-mono text-xs text-text-link break-all">{value}</code>
	);
}

function TableSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="border-b border-border-secondary">
			<div className="px-4 h-6 bg-bg-tertiary border-b border-border-secondary flex items-center">
				<span className="typo-label-xs text-text-tertiary uppercase">
					{title}
				</span>
			</div>
			{children}
		</div>
	);
}

function ResourceTableInfo({ resourceType }: { resourceType: string }) {
	const client = useAidboxClient();
	const tableName = resourceType.toLowerCase();
	const { data, isLoading, error } = useQuery<TableDetails>({
		queryKey: ["lineage-resource-table-details", "public", tableName],
		queryFn: () => fetchTableDetails(client, "public", tableName),
	});

	if (error) {
		return (
			<div className="px-4 py-2 typo-body-xs text-text-error-primary">
				{error instanceof Error ? error.message : String(error)}
			</div>
		);
	}

	if (isLoading || !data) {
		return (
			<>
				<TableSection title="Columns">
					<div className="flex flex-col">
						{Array.from({ length: 5 }, (_, i) => (
							<div
								key={`sk${String(i)}`}
								className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
							>
								<HSComp.Skeleton className="h-3 w-24" />
								<HSComp.Skeleton className="h-3 w-16" />
							</div>
						))}
					</div>
				</TableSection>
				<TableSection title="Indexes">
					<div className="flex flex-col">
						{Array.from({ length: 2 }, (_, i) => (
							<div
								key={`sk${String(i)}`}
								className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
							>
								<HSComp.Skeleton className="h-3 w-32" />
								<HSComp.Skeleton className="h-3 w-12" />
							</div>
						))}
					</div>
				</TableSection>
			</>
		);
	}

	return (
		<>
			<TableSection title="Rows">
				<div className="px-4 py-2">
					<span className="typo-body-xs text-text-primary">
						{formatRowCount(data.rowCount)}
					</span>
				</div>
			</TableSection>
			<TableSection title="Size">
				<div className="flex flex-col">
					<div className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary">
						<span className="typo-body-xs text-text-tertiary">Table data</span>
						<span className="typo-body-xs text-text-primary">
							{data.tableSize}
						</span>
					</div>
					<div className="flex items-center justify-between px-4 py-1.5">
						<span className="typo-body-xs text-text-tertiary">Indexes</span>
						<span className="typo-body-xs text-text-primary">
							{data.indexesSize}
						</span>
					</div>
				</div>
			</TableSection>
			<TableSection title="Columns">
				{data.columns.length > 0 ? (
					<div className="flex flex-col">
						{data.columns.map((col) => (
							<div
								key={col.column_name}
								className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
							>
								<span className="typo-body-xs text-text-primary truncate">
									{col.column_name}
								</span>
								<span className="typo-body-xs text-text-tertiary shrink-0 ml-2">
									{formatColumnType(col)}
									{col.is_nullable === "YES" && ", null"}
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="px-4 py-2 typo-body-xs text-text-disabled">
						No columns
					</div>
				)}
			</TableSection>
			<TableSection title="Indexes">
				{data.indexes.length > 0 ? (
					<div className="flex flex-col">
						{data.indexes.map((idx) => (
							<div
								key={idx.indexname}
								className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
							>
								<span className="typo-body-xs text-text-primary truncate">
									{idx.indexname}
								</span>
								<span className="typo-body-xs text-text-tertiary shrink-0 ml-2">
									{extractIndexType(idx.indexdef)}
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="px-4 py-2 typo-body-xs text-text-disabled">
						No indexes
					</div>
				)}
			</TableSection>
		</>
	);
}

function ResourceDetailContent({
	data,
	onClose,
}: {
	data: ResourceTypeNodeData;
	onClose: () => void;
}) {
	return (
		<div className="h-full overflow-auto flex flex-col bg-bg-primary">
			<div className="p-4 flex flex-col gap-4">
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
			<ResourceTableInfo resourceType={data.resourceType} />
		</div>
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
		return <ResourceDetailContent data={data} onClose={onClose} />;
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
						to="/analytics/views/edit/$id"
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
						<p className="text-sm text-text-primary whitespace-pre-wrap">
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
	const isView = data.libraryKind === "sql-view";
	return (
		<div className="h-full overflow-auto p-4 pb-20 flex flex-col gap-4 bg-bg-primary">
			<PanelHeader
				icon={isView ? <Layers size={14} /> : <FileCode2 size={14} />}
				label={isView ? "SQLView" : "SQLQuery"}
				color={
					isView ? "text-text-success-primary" : "text-text-warning-primary"
				}
				onClose={onClose}
			/>
			<div className="flex flex-col gap-1">
				<span className="text-xs typo-label-tiny text-text-tertiary uppercase">
					ID
				</span>
				<Link
					to={
						isView
							? "/analytics/sqlview/edit/$id"
							: "/analytics/queries/edit/$id"
					}
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
					<p className="text-sm text-text-primary whitespace-pre-wrap">
						{data.description}
					</p>
				</Section>
			)}
			{!isView &&
				(() => {
					const ownNames = new Set(data.parameters.map((p) => p.name));
					const merged = [
						...data.parameters.map((p) => ({ ...p, inherited: false })),
						...data.inheritedParameters
							.filter((p) => !ownNames.has(p.name))
							.map((p) => ({ ...p, inherited: true })),
					];
					return (
						<Section title={`Parameters (${merged.length})`}>
							{merged.length === 0 ? (
								<span className="text-xs text-text-tertiary italic">none</span>
							) : (
								<ul className="list-disc pl-4 flex flex-col gap-0.5">
									{merged.map((p) => (
										<li key={p.name} className="text-xs font-mono">
											<span className="text-text-primary">{p.name}</span>
											{p.type && (
												<span className="text-text-tertiary"> ({p.type})</span>
											)}
											{p.inherited && (
												<span className="ml-1 text-[10px] text-text-tertiary italic">
													inherited
												</span>
											)}
										</li>
									))}
								</ul>
							)}
						</Section>
					);
				})()}
			{data.sql && (
				<Section title="SQL">
					<div
						className="border border-border-primary rounded overflow-hidden"
						style={{
							height: Math.max(
								160,
								Math.min(480, data.sql.split("\n").length * 20 + 32),
							),
						}}
					>
						<HSComp.CodeEditor readOnly currentValue={data.sql} mode="sql" />
					</div>
				</Section>
			)}
		</div>
	);
}
