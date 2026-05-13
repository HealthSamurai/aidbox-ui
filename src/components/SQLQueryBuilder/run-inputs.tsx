import * as HSComp from "@health-samurai/react-components";
import { AlertTriangle, Link } from "lucide-react";
import { useSQLQueryContext } from "./context";
import {
	type ResolvedParameter,
	useResolvedParameterTree,
} from "./resolve-tree";
import type { SQLParameter } from "./types";

type Field = {
	name: string;
	type: string;
	source: "own" | ResolvedParameter;
	conflict?: boolean;
};

function ParamField({
	field,
	value,
	onChange,
}: {
	field: Field;
	value: string;
	onChange: (value: string) => void;
}) {
	const inputId = `run-input-${field.name}`;
	return (
		<div className="flex flex-col gap-1 min-w-0">
			<label
				htmlFor={inputId}
				className="flex items-center gap-1.5 text-xs font-mono text-text-tertiary"
			>
				{field.source !== "own" && <SourceTag field={field} />}
				<span className="truncate">{field.name}</span>
			</label>
			{field.type === "boolean" ? (
				<HSComp.Switch
					id={inputId}
					checked={value === "true"}
					onCheckedChange={(c) => onChange(c ? "true" : "false")}
				/>
			) : (
				<HSComp.Input
					id={inputId}
					type="text"
					placeholder={field.type}
					className="font-mono text-xs"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
			)}
		</div>
	);
}

function SourceTag({ field }: { field: Field }) {
	if (field.source === "own") return null;
	const sources = field.source.sources;
	const hasConflict = !!field.conflict;

	return (
		<HSComp.Tooltip delayDuration={250}>
			<HSComp.TooltipTrigger asChild>
				<span
					className={`inline-flex items-center justify-center w-5 h-5 rounded ${
						hasConflict ? "text-text-error-primary" : "text-text-link"
					}`}
				>
					{hasConflict ? <AlertTriangle size={12} /> : <Link size={12} />}
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

function ownFields(params: SQLParameter[]): Field[] {
	const out: Field[] = [];
	for (const p of params) {
		if (!p.name) continue;
		out.push({ name: p.name, type: p.type ?? "string", source: "own" });
	}
	return out;
}

function inheritedFields(
	inherited: ResolvedParameter[],
	ownNames: Set<string>,
	conflictNames: Set<string>,
): Field[] {
	return inherited
		.filter((p) => !ownNames.has(p.name))
		.map((p) => ({
			name: p.name,
			type: p.type ?? "string",
			source: p,
			conflict: conflictNames.has(p.name),
		}));
}

export function RunInputs() {
	const { library, paramValues, setParamValue } = useSQLQueryContext();
	const { tree } = useResolvedParameterTree(library);

	const params = library.parameter ?? [];
	const own = ownFields(params);
	const ownNames = new Set(own.map((f) => f.name));
	const conflictNames = new Set(tree.conflicts.map((c) => c.name));
	const inherited = inheritedFields(tree.inherited, ownNames, conflictNames);

	if (own.length === 0 && inherited.length === 0) return null;

	return (
		<div className="flex flex-col border-b">
			<div className="flex items-center bg-bg-secondary px-4 h-10 border-b shrink-0">
				<span className="typo-label text-text-secondary">Parameter values</span>
			</div>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-4 gap-y-2 px-4 py-3 bg-bg-primary">
				{inherited.map((field) => (
					<ParamField
						key={`inh-${field.name}`}
						field={field}
						value={paramValues[field.name] ?? ""}
						onChange={(v) => setParamValue(field.name, v)}
					/>
				))}
				{own.map((field) => (
					<ParamField
						key={`own-${field.name}`}
						field={field}
						value={paramValues[field.name] ?? ""}
						onChange={(v) => setParamValue(field.name, v)}
					/>
				))}
			</div>
		</div>
	);
}
