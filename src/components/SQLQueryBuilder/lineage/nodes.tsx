import * as HSComp from "@health-samurai/react-components";
import { Handle, Position } from "@xyflow/react";
import { Database, FileCode2, Table } from "lucide-react";
import type * as React from "react";
import {
	BaseNode,
	BaseNodeBody,
	BaseNodeHeader,
	BaseNodeRow,
} from "./base-node";
import type {
	ColumnInfo,
	ResourceTypeNodeData,
	SQLQueryNodeData,
	ViewDefinitionNodeData,
	ViewSelect,
} from "./types";

function flattenColumns(selects: ViewSelect[]): ColumnInfo[] {
	const out: ColumnInfo[] = [];
	const walk = (list: ViewSelect[]) => {
		for (const s of list) {
			for (const c of s.column ?? []) out.push(c);
			if (s.select) walk(s.select);
			if (s.unionAll) walk(s.unionAll);
		}
	};
	walk(selects);
	return out;
}

type AnyNodeProps = {
	data: Record<string, unknown>;
	selected?: boolean;
};

export function ResourceTypeNode({ data, selected }: AnyNodeProps) {
	const d = data as unknown as ResourceTypeNodeData;
	return (
		<BaseNode selected={selected}>
			<BaseNodeHeader>
				<div className="flex items-center gap-2">
					<Database size={14} className="text-text-success-primary shrink-0" />
					<span className="font-mono text-xs text-text-success-primary uppercase">
						Resource
					</span>
				</div>
				<div className="font-mono text-sm font-medium text-text-primary truncate">
					{d.resourceType}
				</div>
			</BaseNodeHeader>
			<Handle
				type="source"
				position={Position.Right}
				className="w-2 h-2 right-0!"
			/>
		</BaseNode>
	);
}

function NodeWithTooltip({
	tooltip,
	children,
}: {
	tooltip: string | undefined;
	children: React.ReactNode;
}) {
	if (!tooltip) return <>{children}</>;
	return (
		<HSComp.Tooltip delayDuration={200}>
			<HSComp.TooltipTrigger asChild>
				<div>{children}</div>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent
				side="top"
				align="start"
				className="max-w-md p-3 bg-bg-primary text-text-primary border border-border-primary shadow-md"
			>
				<span className="text-xs">{tooltip}</span>
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

export function ViewDefinitionNode({ data, selected }: AnyNodeProps) {
	const d = data as unknown as ViewDefinitionNodeData;
	const display = d.title || d.name || d.id;
	return (
		<NodeWithTooltip tooltip={d.description}>
			<BaseNode selected={selected}>
				<BaseNodeHeader>
					<div className="flex items-center gap-2">
						<Table size={14} className="text-text-info-primary shrink-0" />
						<span className="font-mono text-xs text-text-info-primary uppercase">
							View
						</span>
					</div>
					<div className="font-mono text-sm font-medium text-text-primary truncate">
						{display}
					</div>
				</BaseNodeHeader>
				<BaseNodeBody>
					{(() => {
						const columns = flattenColumns(d.select);
						return columns.length === 0 ? (
							<div className="px-3 py-2 text-xs text-text-tertiary italic">
								no columns
							</div>
						) : (
							columns.map((c) => (
								<BaseNodeRow key={c.name}>
									<span className="font-mono text-xs text-text-primary truncate">
										{c.name}
									</span>
								</BaseNodeRow>
							))
						);
					})()}
				</BaseNodeBody>
				<Handle
					type="target"
					position={Position.Left}
					className="w-2 h-2 left-0!"
				/>
				<Handle
					type="source"
					position={Position.Right}
					className="w-2 h-2 right-0!"
				/>
			</BaseNode>
		</NodeWithTooltip>
	);
}

export function SQLQueryNode({ data, selected }: AnyNodeProps) {
	const d = data as unknown as SQLQueryNodeData;
	const display = d.title || d.name || d.id;
	return (
		<NodeWithTooltip tooltip={d.description}>
			<BaseNode
				selected={selected}
				className={d.isRoot ? "border-border-link" : ""}
			>
				<BaseNodeHeader>
					<div className="flex items-center gap-2">
						<FileCode2 size={14} className="text-text-brand-primary shrink-0" />
						<span className="font-mono text-xs text-text-brand-primary uppercase">
							Query
						</span>
					</div>
					<div className="font-mono text-sm font-medium text-text-primary truncate">
						{display}
					</div>
				</BaseNodeHeader>
				<BaseNodeBody>
					{d.parameters.length === 0 ? (
						<div className="px-3 py-2 text-xs text-text-tertiary italic">
							no parameters
						</div>
					) : (
						d.parameters.map((p) => (
							<BaseNodeRow key={p.name}>
								<span className="font-mono text-xs text-text-primary truncate">
									{p.name}
								</span>
								<span className="font-mono text-xs text-text-tertiary text-right truncate">
									{p.type ?? ""}
								</span>
							</BaseNodeRow>
						))
					)}
				</BaseNodeBody>
				<Handle
					type="target"
					position={Position.Left}
					className="w-2 h-2 left-0!"
				/>
				{!d.isRoot && (
					<Handle
						type="source"
						position={Position.Right}
						className="w-2 h-2 right-0!"
					/>
				)}
			</BaseNode>
		</NodeWithTooltip>
	);
}

export const nodeTypes = {
	"resource-type": ResourceTypeNode,
	"view-definition": ViewDefinitionNode,
	"sql-query": SQLQueryNode,
};
