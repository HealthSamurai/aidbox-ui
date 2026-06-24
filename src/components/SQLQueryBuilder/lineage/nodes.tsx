import * as HSComp from "@health-samurai/react-components";
import { Handle, Position } from "@xyflow/react";
import { Database, FileCode2, Layers, PlayIcon, Table } from "lucide-react";
import * as React from "react";
import {
	BaseNode,
	BaseNodeBody,
	BaseNodeFooter,
	BaseNodeHeader,
	BaseNodeRow,
} from "./base-node";
import { readStoredParamValues } from "./param-storage";
import { useLineageRunContext } from "./run-context";
import type {
	ColumnInfo,
	ParamSpec,
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
	id: string;
	data: Record<string, unknown>;
	selected?: boolean;
};

function ViewNodeFooter({
	nodeId,
	viewId,
}: {
	nodeId: string;
	viewId: string;
}) {
	const { runView, runningNodeId } = useLineageRunContext();
	const isRunningThis = runningNodeId === nodeId;
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!viewId) return;
		runView(nodeId, viewId);
	};
	return (
		<BaseNodeFooter>
			<HSComp.Button
				variant="link"
				size="small"
				className="px-0! text-text-link! hover:text-text-link/80! disabled:opacity-50"
				onClick={handleClick}
				disabled={runningNodeId !== null || !viewId}
			>
				<PlayIcon className="w-3.5 h-3.5 fill-current" />
				{isRunningThis ? "Running…" : "RUN"}
			</HSComp.Button>
		</BaseNodeFooter>
	);
}

const stopProp = (e: React.SyntheticEvent) => {
	e.stopPropagation();
};

function ParamValueInput({
	type,
	value,
	onChange,
}: {
	type: string | undefined;
	value: string;
	onChange: (v: string) => void;
}) {
	const effectiveType = type ?? "string";
	if (effectiveType === "boolean") {
		return (
			<HSComp.Switch
				size="small"
				checked={value === "true"}
				onCheckedChange={(c) => onChange(c ? "true" : "false")}
				onClick={stopProp}
				onMouseDown={stopProp}
				className="nodrag nopan"
			/>
		);
	}
	return (
		<input
			type="text"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onClick={stopProp}
			onMouseDown={stopProp}
			onKeyDown={stopProp}
			placeholder="value"
			className="nodrag nopan h-4 leading-4 w-full text-xs font-mono bg-transparent outline-none placeholder:text-text-tertiary"
		/>
	);
}

function QueryNodeFooter({
	nodeId,
	queryId,
	allParams,
	paramValues,
	hasMissing,
}: {
	nodeId: string;
	queryId: string;
	allParams: ParamSpec[];
	paramValues: Record<string, string>;
	hasMissing: boolean;
}) {
	const { runQuery, runningNodeId } = useLineageRunContext();
	const isRunningThis = runningNodeId === nodeId;
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!queryId) return;
		runQuery({ nodeId, queryId, allParams, paramValues });
	};
	return (
		<BaseNodeFooter>
			<HSComp.Button
				variant="link"
				size="small"
				className="px-0! text-text-link! hover:text-text-link/80! disabled:opacity-50"
				onClick={handleClick}
				disabled={runningNodeId !== null || !queryId || hasMissing}
			>
				<PlayIcon className="w-3.5 h-3.5 fill-current" />
				{isRunningThis ? "Running…" : "RUN"}
			</HSComp.Button>
		</BaseNodeFooter>
	);
}

export function ResourceTypeNode({ data, selected }: Omit<AnyNodeProps, "id">) {
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

export function ViewDefinitionNode({ id, data, selected }: AnyNodeProps) {
	const d = data as unknown as ViewDefinitionNodeData;
	const display = d.title || d.name || d.id;
	return (
		<BaseNode selected={selected}>
			<BaseNodeHeader>
				<div className="flex items-center gap-2">
					<Table size={14} className="text-text-info-primary shrink-0" />
					<span className="font-mono text-xs text-text-info-primary uppercase">
						VIEW
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
									{c.collection ? "[]" : ""}
								</span>
								<span className="font-mono text-xs text-text-tertiary text-right truncate">
									{c.type ?? ""}
								</span>
							</BaseNodeRow>
						))
					);
				})()}
			</BaseNodeBody>
			<ViewNodeFooter nodeId={id} viewId={d.id} />
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
	);
}

export function SQLQueryNode({ id, data, selected }: AnyNodeProps) {
	const d = data as unknown as SQLQueryNodeData;
	const display = d.title || d.name || d.id;

	const allParams = React.useMemo<ParamSpec[]>(() => {
		const seen = new Set(d.parameters.map((p) => p.name));
		return [
			...d.parameters,
			...d.inheritedParameters.filter((ip) => !seen.has(ip.name)),
		];
	}, [d.parameters, d.inheritedParameters]);

	const [paramValues, setParamValues] = React.useState<Record<string, string>>(
		() => readStoredParamValues(d.id),
	);

	const setParamValue = React.useCallback((name: string, value: string) => {
		setParamValues((prev) => ({ ...prev, [name]: value }));
	}, []);

	const hasMissing = React.useMemo(() => {
		for (const p of allParams) {
			const t = p.type ?? "string";
			if (t === "boolean") continue;
			const v = paramValues[p.name];
			if (v === undefined || v === "") return true;
		}
		return false;
	}, [allParams, paramValues]);

	const showInputs = (selected ?? false) && allParams.length > 0;

	const isView = d.libraryKind === "sql-view";
	const headerInner = (
		<>
			<div className="flex items-center gap-2">
				{isView ? (
					<Layers size={14} className="text-text-success-primary shrink-0" />
				) : (
					<FileCode2 size={14} className="text-text-warning-primary shrink-0" />
				)}
				<span
					className={`font-mono text-xs uppercase ${isView ? "text-text-success-primary" : "text-text-warning-primary"}`}
				>
					{isView ? "SQLView" : "SQLQuery"}
				</span>
			</div>
			<div className="font-mono text-sm font-medium text-text-primary truncate">
				{display}
			</div>
		</>
	);

	return (
		<div className="flex items-start">
			<BaseNode
				selected={selected}
				className={d.isRoot ? "border-border-link" : ""}
			>
				<BaseNodeHeader className={isView ? "border-b-0" : undefined}>
					{headerInner}
				</BaseNodeHeader>
				{!isView && (
					<BaseNodeBody>
						{allParams.length === 0 ? (
							<div className="px-3 py-2 text-xs text-text-tertiary italic">
								no parameters
							</div>
						) : (
							allParams.map((p) => (
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
				)}
				<QueryNodeFooter
					nodeId={id}
					queryId={d.id}
					allParams={allParams}
					paramValues={paramValues}
					hasMissing={hasMissing}
				/>
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

			{showInputs && (
				<div className="flex flex-col ml-2">
					<div className="invisible pointer-events-none" aria-hidden="true">
						<BaseNodeHeader>{headerInner}</BaseNodeHeader>
					</div>
					<div className="w-[180px] -mt-6 rounded-md bg-bg-primary border border-border-primary shadow-sm overflow-hidden">
						<div className="px-2 h-6 bg-bg-tertiary border-b border-border-secondary flex items-center">
							<span className="typo-label-xs text-text-tertiary uppercase">
								Run parameter values
							</span>
						</div>
						{allParams.map((p) => (
							<div
								key={p.name}
								className="px-2 py-1 border-b border-border-primary last:border-b-0 flex items-center"
							>
								<ParamValueInput
									type={p.type}
									value={paramValues[p.name] ?? ""}
									onChange={(v) => setParamValue(p.name, v)}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export const nodeTypes = {
	"resource-type": ResourceTypeNode,
	"view-definition": ViewDefinitionNode,
	"sql-query": SQLQueryNode,
};
