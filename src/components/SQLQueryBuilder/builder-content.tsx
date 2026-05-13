import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { useSQLQueryContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import { useResolvedParameterTree } from "./resolve-tree";
import { ResultPanel } from "./result-panel";
import { RunInputs } from "./run-inputs";
import {
	SQL_QUERY_PROFILE,
	SQL_QUERY_TYPE_CODE,
	SQL_QUERY_TYPE_SYSTEM,
	type SQLLibrary,
} from "./types";

function ensureSQLQueryShape(lib: SQLLibrary): SQLLibrary {
	const profiles = lib.meta?.profile ?? [];
	const hasProfile = profiles.includes(SQL_QUERY_PROFILE);
	const hasType = lib.type?.coding?.some(
		(c) => c.system === SQL_QUERY_TYPE_SYSTEM && c.code === SQL_QUERY_TYPE_CODE,
	);
	return {
		...lib,
		resourceType: "Library",
		meta: hasProfile
			? lib.meta
			: { ...(lib.meta ?? {}), profile: [...profiles, SQL_QUERY_PROFILE] },
		type: hasType
			? lib.type
			: {
					coding: [
						{ system: SQL_QUERY_TYPE_SYSTEM, code: SQL_QUERY_TYPE_CODE },
					],
				},
		status: lib.status ?? "active",
	};
}

function capitalizeFirstLetter(s: string): string {
	return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function buildParamValueEntry(
	name: string,
	type: string,
	raw: string,
): Record<string, unknown> | null {
	if (raw === "") return null;
	const valueField = `value${capitalizeFirstLetter(type)}`;
	let value: unknown = raw;
	if (type === "integer") {
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "decimal") {
		const n = Number.parseFloat(raw);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "boolean") {
		value = raw === "true";
	}
	return { name, [valueField]: value };
}

type FhirParametersResponse = {
	resourceType: "Parameters";
	parameter?: Array<{
		name?: string;
		part?: Array<{ name?: string; [key: `value${string}`]: unknown }>;
	}>;
};

function getPartValue(
	part: { name?: string; [key: string]: unknown } | undefined,
): unknown {
	if (!part) return null;
	for (const key of Object.keys(part)) {
		if (key.startsWith("value")) return part[key];
	}
	return null;
}

function fhirParametersToRunResult(body: FhirParametersResponse): {
	columns: string[];
	rows: unknown[][];
} {
	const rowParams = (body.parameter ?? []).filter((p) => p.name === "row");
	if (rowParams.length === 0) return { columns: [], rows: [] };
	const columns: string[] = [];
	const seen = new Set<string>();
	for (const rp of rowParams) {
		for (const part of rp.part ?? []) {
			if (part.name && !seen.has(part.name)) {
				seen.add(part.name);
				columns.push(part.name);
			}
		}
	}
	const rows = rowParams.map((rp) => {
		const byName = new Map<string, unknown>();
		for (const part of rp.part ?? []) {
			if (part.name) byName.set(part.name, getPartValue(part));
		}
		return columns.map((c) => byName.get(c) ?? null);
	});
	return { columns, rows };
}

function buildAllParamEntries(
	library: SQLLibrary,
	inheritedTypes: Map<string, string>,
	paramValues: Record<string, string>,
): Record<string, unknown>[] {
	const types = new Map<string, string>();
	for (const p of library.parameter ?? []) {
		if (p.name) types.set(p.name, p.type ?? "string");
	}
	for (const [name, type] of inheritedTypes) {
		if (!types.has(name)) types.set(name, type);
	}
	const entries: Record<string, unknown>[] = [];
	for (const [name, type] of types) {
		const raw = paramValues[name];
		if (raw === undefined) continue;
		const entry = buildParamValueEntry(name, type, raw);
		if (entry) entries.push(entry);
	}
	return entries;
}

export function SQLQueryBuilderContent() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const {
		library,
		setIsDirty,
		isDirty,
		setRunResult,
		setRunError,
		runError,
		setIsRunning,
		paramValues,
	} = useSQLQueryContext();

	const { tree: resolvedTree } = useResolvedParameterTree(library);
	const inheritedTypes = React.useMemo(() => {
		const m = new Map<string, string>();
		for (const p of resolvedTree.inherited) {
			if (!m.has(p.name)) m.set(p.name, p.type ?? "string");
		}
		return m;
	}, [resolvedTree.inherited]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const payload = ensureSQLQueryShape(library);
			if (payload.id) {
				const result = await client.request({
					method: "PUT",
					url: `/fhir/Library/${payload.id}`,
					body: JSON.stringify(payload),
					headers: { "Content-Type": "application/json" },
				});
				if (result.isErr()) throw result.value.resource;
				return result.value.resource;
			}
			const result = await client.request({
				method: "POST",
				url: "/fhir/Library",
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: () => {
			setIsDirty(false);
			HSComp.toast.success("Saved");
			queryClient.invalidateQueries({ queryKey: ["data-lineage-queries"] });
		},
		onError: () => {
			HSComp.toast.error("Failed to save");
		},
	});

	const runMutation = useMutation({
		mutationFn: async () => {
			setRunError(null);
			setRunResult(null);
			setIsRunning(true);
			const payload = ensureSQLQueryShape(library);
			const valueEntries = buildAllParamEntries(
				payload,
				inheritedTypes,
				paramValues,
			);
			const topLevelParameters: Record<string, unknown>[] = [
				{ name: "_format", valueCode: "fhir" },
			];
			if (!payload.id) {
				topLevelParameters.push({ name: "queryResource", resource: payload });
			}
			if (valueEntries.length > 0) {
				topLevelParameters.push({
					name: "parameters",
					resource: {
						resourceType: "Parameters",
						parameter: valueEntries,
					},
				});
			}
			const result = await client.request<FhirParametersResponse>({
				method: "POST",
				url: payload.id
					? `/fhir/Library/${payload.id}/$sqlquery-run`
					: "/fhir/$sqlquery-run",
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: topLevelParameters,
				}),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) {
				throw result.value.resource;
			}
			return result.value.resource;
		},
		onSuccess: (data) => {
			setIsRunning(false);
			const body = data as unknown as FhirParametersResponse;
			setRunResult(fhirParametersToRunResult(body));
		},
		onError: (err) => {
			setIsRunning(false);
			const isOO =
				typeof err === "object" &&
				err !== null &&
				"resourceType" in err &&
				(err as { resourceType: string }).resourceType === "OperationOutcome";
			setRunError(
				isOO
					? (err as unknown as HSComp.OperationOutcome)
					: {
							resourceType: "OperationOutcome",
							issue: [
								{
									severity: "error",
									code: "exception",
									diagnostics: err instanceof Error ? err.message : String(err),
								},
							],
						},
			);
		},
	});

	const runMutationRef = React.useRef(runMutation);
	runMutationRef.current = runMutation;

	React.useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				const m = runMutationRef.current;
				if (!m.isPending) m.mutate();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<HSComp.ResizablePanelGroup
			direction="vertical"
			autoSaveId="sqlquery-builder-vertical"
			className="grow min-h-0"
		>
			<HSComp.ResizablePanel minSize={20}>
				<div className="flex flex-col h-full">
					<EditorHeaderMenu
						onRun={() => runMutation.mutate()}
						onSave={() => saveMutation.mutate()}
						isRunDisabled={runMutation.isPending}
						isSaveDisabled={!isDirty || saveMutation.isPending}
					/>
					<div className="flex-1 min-h-0 overflow-auto">
						<div className="min-h-full bg-bg-primary px-2.5 py-3">
							<PropertiesTree />
						</div>
					</div>
				</div>
			</HSComp.ResizablePanel>
			{runError && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel defaultSize={20} minSize={10}>
						<HSComp.OperationOutcomeView
							resource={runError}
							className="h-full overflow-auto"
						/>
					</HSComp.ResizablePanel>
				</>
			)}
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel defaultSize={30} minSize={10}>
				<div className="flex flex-col h-full">
					<RunInputs />
					<div className="flex-1 min-h-0">
						<ResultPanel />
					</div>
				</div>
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
}
