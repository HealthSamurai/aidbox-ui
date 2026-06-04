import * as HSComp from "@health-samurai/react-components";
import { Handle, Position } from "@xyflow/react";
import {
	AlertCircle,
	Database,
	FileText,
	ListTree,
	PlayIcon,
} from "lucide-react";
import type * as React from "react";
import {
	BaseNode,
	BaseNodeBody,
	BaseNodeFooter,
	BaseNodeHeader,
	BaseNodeRow,
} from "../../SQLQueryBuilder/lineage/base-node";
import { useGraphRunContext } from "./run-context";
import type {
	CodeSystemNodeData,
	UnresolvedNodeData,
	ValueSetNodeData,
} from "./types";

type AnyNodeProps = {
	id: string;
	data: Record<string, unknown>;
	selected?: boolean;
};

export const HANDLE_COUNT = 5;

const HANDLE_TOPS = Array.from(
	{ length: HANDLE_COUNT },
	(_, i) => `${((i + 1) / (HANDLE_COUNT + 1)) * 100}%`,
);

function TargetHandles() {
	return (
		<>
			{HANDLE_TOPS.map((top) => (
				<Handle
					key={`target-${top}`}
					id={`target-${top}`}
					type="target"
					position={Position.Right}
					className="w-2 h-2 right-0! opacity-0"
					style={{ top }}
				/>
			))}
		</>
	);
}

function SourceHandles() {
	return (
		<>
			{HANDLE_TOPS.map((top) => (
				<Handle
					key={`source-${top}`}
					id={`source-${top}`}
					type="source"
					position={Position.Left}
					className="w-2 h-2 left-0! opacity-0"
					style={{ top }}
				/>
			))}
		</>
	);
}

function ExpandFooter({
	nodeId,
	isRoot,
	url,
	version,
}: {
	nodeId: string;
	isRoot: boolean;
	url?: string;
	version?: string;
}) {
	const { run, runningNodeId } = useGraphRunContext();
	const isRunningThis = runningNodeId === nodeId;
	const disabled = !isRoot && !url;
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (disabled) return;
		run({ kind: "expand", nodeId, isRoot, url, version });
	};
	return (
		<BaseNodeFooter className="border-t-0">
			<HSComp.Button
				variant="link"
				size="small"
				className="px-0! text-text-link! hover:text-text-link/80! disabled:opacity-50"
				onClick={handleClick}
				disabled={runningNodeId !== null || disabled}
			>
				<PlayIcon className="w-3.5 h-3.5 fill-current" />
				{isRunningThis ? "Expanding…" : "EXPAND"}
			</HSComp.Button>
		</BaseNodeFooter>
	);
}

function ContentFooter({
	nodeId,
	csId,
	url,
	version,
}: {
	nodeId: string;
	csId?: string;
	url?: string;
	version?: string;
}) {
	const { run, runningNodeId } = useGraphRunContext();
	const isRunningThis = runningNodeId === nodeId;
	const disabled = !csId && !url;
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (disabled) return;
		run({ kind: "content", nodeId, csId, url, version });
	};
	return (
		<BaseNodeFooter className="border-t-0">
			<HSComp.Button
				variant="link"
				size="small"
				className="px-0! text-text-link! hover:text-text-link/80! disabled:opacity-50"
				onClick={handleClick}
				disabled={runningNodeId !== null || disabled}
			>
				<FileText className="w-3.5 h-3.5" />
				{isRunningThis ? "Loading…" : "CONTENT"}
			</HSComp.Button>
		</BaseNodeFooter>
	);
}

export function ValueSetNode({ id, data, selected }: AnyNodeProps) {
	const d = data as unknown as ValueSetNodeData;
	const titleLine = d.title || d.name || d.id || "(unnamed)";
	const urlLine = d.url ? `${d.url}${d.version ? `|${d.version}` : ""}` : null;
	return (
		<BaseNode
			selected={selected}
			className={`w-[350px]! ${d.isRoot ? "border-border-link" : ""}`}
		>
			<BaseNodeHeader>
				<div className="flex items-center gap-2">
					<ListTree size={14} className="text-text-info-primary shrink-0" />
					<span className="font-mono text-xs text-text-info-primary uppercase">
						ValueSet
					</span>
					{d.isRoot && (
						<span className="font-mono text-[10px] text-text-tertiary uppercase">
							root
						</span>
					)}
				</div>
				<div className="text-sm font-medium text-text-primary truncate">
					{titleLine}
				</div>
				{urlLine && (
					<div className="font-mono text-xs text-text-tertiary truncate">
						{urlLine}
					</div>
				)}
			</BaseNodeHeader>
			<ExpandFooter
				nodeId={id}
				isRoot={d.isRoot}
				url={d.url}
				version={d.version}
			/>
			{!d.isRoot && <TargetHandles />}
			<SourceHandles />
		</BaseNode>
	);
}

export function CodeSystemNode({ id, data, selected }: AnyNodeProps) {
	const d = data as unknown as CodeSystemNodeData;
	const titleLine = d.title || d.name || d.id || "(unnamed)";
	const urlLine = d.url ? `${d.url}${d.version ? `|${d.version}` : ""}` : null;
	return (
		<BaseNode selected={selected} className="w-[350px]!">
			<BaseNodeHeader>
				<div className="flex items-center gap-2">
					<Database size={14} className="text-text-success-primary shrink-0" />
					<span className="font-mono text-xs text-text-success-primary uppercase">
						CodeSystem
					</span>
				</div>
				<div className="text-sm font-medium text-text-primary truncate">
					{titleLine}
				</div>
				{urlLine && (
					<div className="font-mono text-xs text-text-tertiary truncate">
						{urlLine}
					</div>
				)}
			</BaseNodeHeader>
			<BaseNodeBody>
				{typeof d.count === "number" && (
					<BaseNodeRow>
						<span className="font-mono text-xs text-text-tertiary">count</span>
						<span className="font-mono text-xs text-text-primary text-right truncate">
							{d.count.toLocaleString()}
						</span>
					</BaseNodeRow>
				)}
			</BaseNodeBody>
			{d.content === "complete" && (
				<ContentFooter
					nodeId={id}
					csId={d.id}
					url={d.url}
					version={d.version}
				/>
			)}
			<TargetHandles />
			<SourceHandles />
		</BaseNode>
	);
}

export function UnresolvedNode({ data, selected }: AnyNodeProps) {
	const d = data as unknown as UnresolvedNodeData;
	const color =
		d.resourceKind === "ValueSet"
			? "text-text-info-primary"
			: "text-text-success-primary";
	return (
		<div
			className={`rounded-md bg-bg-secondary border border-dashed shadow-sm overflow-hidden w-[350px] ${selected ? "border-border-link" : "border-border-primary"}`}
		>
			<div className="flex flex-col gap-2 px-3 py-2 border-b border-border-primary border-dashed">
				<div className="flex items-center gap-2">
					<AlertCircle size={14} className={`${color} shrink-0`} />
					<span className={`font-mono text-xs ${color} uppercase`}>
						{d.resourceKind}
					</span>
					<span className="font-mono text-[10px] text-text-tertiary uppercase">
						unresolved
					</span>
				</div>
				<div className="font-mono text-sm text-text-primary truncate">
					{d.url}
					{d.version ? `|${d.version}` : ""}
				</div>
			</div>
			<TargetHandles />
		</div>
	);
}

export const nodeTypes = {
	"value-set": ValueSetNode,
	"code-system": CodeSystemNode,
	unresolved: UnresolvedNode,
};
