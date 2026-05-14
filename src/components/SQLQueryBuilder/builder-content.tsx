import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PanelBottomOpen } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks";
import { useSQLQueryContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import { useResolvedParameterTree } from "./resolve-tree";
import { ResultPanel } from "./result-panel";
import {
	SQL_QUERY_PROFILE,
	SQL_QUERY_TYPE_CODE,
	SQL_QUERY_TYPE_SYSTEM,
	type SQLLibrary,
} from "./types";
import { addUrlToHistory } from "./url-history";

function toOperationOutcome(err: unknown): HSComp.OperationOutcome {
	if (
		typeof err === "object" &&
		err !== null &&
		"resourceType" in err &&
		(err as { resourceType: string }).resourceType === "OperationOutcome"
	) {
		return err as unknown as HSComp.OperationOutcome;
	}
	return {
		resourceType: "OperationOutcome",
		issue: [
			{
				severity: "error",
				code: "exception",
				diagnostics: err instanceof Error ? err.message : String(err),
			},
		],
	};
}

function cleanEmptyValues<T>(obj: T): T {
	if (Array.isArray(obj)) {
		const cleanedArray = obj
			.map((item) => cleanEmptyValues(item))
			.filter((item) => {
				if (item === null || item === undefined) return false;
				if (typeof item === "string" && item === "") return false;
				if (Array.isArray(item) && item.length === 0) return false;
				if (
					typeof item === "object" &&
					!Array.isArray(item) &&
					Object.keys(item as Record<string, unknown>).length === 0
				)
					return false;
				return true;
			});
		return cleanedArray as T;
	}
	if (obj !== null && typeof obj === "object") {
		const cleanedObj: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleanedValue = cleanEmptyValues(value);
			if (cleanedValue === null || cleanedValue === undefined) continue;
			if (typeof cleanedValue === "string" && cleanedValue === "") continue;
			if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
			if (
				typeof cleanedValue === "object" &&
				!Array.isArray(cleanedValue) &&
				Object.keys(cleanedValue as Record<string, unknown>).length === 0
			)
				continue;
			cleanedObj[key] = cleanedValue;
		}
		return cleanedObj as T;
	}
	return obj;
}

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
	if (raw === "" && type !== "boolean") return null;
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
		let raw = paramValues[name];
		if (raw === undefined) {
			if (type !== "boolean") continue;
			raw = "";
		}
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
		runResult,
		setRunResult,
		setRunError,
		runError,
		isRunning,
		setIsRunning,
		paramValues,
		persistParamValues,
		setMissingParams,
		triggerRunRef,
		onCreated,
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
			setRunError(null);
			const shaped = ensureSQLQueryShape(library);
			const trimmed: SQLLibrary = {
				...shaped,
				relatedArtifact: (shaped.relatedArtifact ?? []).filter(
					(ra) => ra.label || ra.resource,
				),
				parameter: (shaped.parameter ?? []).filter((p) => p.name),
			};
			const payload = cleanEmptyValues(trimmed);
			if (payload.id) {
				const result = await client.request({
					method: "PUT",
					url: `/fhir/Library/${payload.id}`,
					body: JSON.stringify(payload),
					headers: { "Content-Type": "application/json" },
				});
				if (result.isErr()) throw result.value.resource;
				return { resource: result.value.resource, created: false };
			}
			const result = await client.request<SQLLibrary>({
				method: "POST",
				url: "/fhir/Library",
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) throw result.value.resource;
			return { resource: result.value.resource, created: true };
		},
		onSuccess: ({ resource, created }) => {
			setIsDirty(false);
			addUrlToHistory(library.url);
			HSComp.toast.success("SQLQuery saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			queryClient.invalidateQueries({ queryKey: ["data-lineage-queries"] });
			if (created && onCreated) {
				const id = (resource as SQLLibrary).id;
				if (id) onCreated(id);
			}
		},
		onError: (err) => {
			const oo = toOperationOutcome(err);
			Utils.toastError(
				"Failed to save SQLQuery",
				oo.issue?.[0]?.diagnostics ?? undefined,
			);
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
				{ name: "queryResource", resource: payload },
			];
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
				url: "/fhir/$sqlquery-run",
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
			persistParamValues();
		},
		onError: (err) => {
			setIsRunning(false);
			setRunError(toOperationOutcome(err));
		},
	});

	const [isResultCollapsed, setIsResultCollapsed] = useLocalStorage<boolean>({
		key: "sqlquery-builder:result-collapsed",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [isMaximized, setIsMaximized] = React.useState(false);

	const handleToggleCollapse = React.useCallback(() => {
		setIsResultCollapsed((prev) => !prev);
		setIsMaximized(false);
	}, [setIsResultCollapsed]);

	const handleToggleMaximize = React.useCallback(() => {
		setIsMaximized((prev) => !prev);
	}, []);

	const handleExpandResult = React.useCallback(() => {
		setIsResultCollapsed(false);
	}, [setIsResultCollapsed]);

	React.useEffect(() => {
		if (!isMaximized) return;
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [isMaximized]);

	const runMutationRef = React.useRef(runMutation);
	runMutationRef.current = runMutation;

	const triggerRun = React.useCallback(() => {
		const m = runMutationRef.current;
		if (m.isPending) return;
		const types = new Map<string, string>();
		for (const p of library.parameter ?? []) {
			if (p.name) types.set(p.name, p.type ?? "string");
		}
		for (const [n, t] of inheritedTypes) {
			if (!types.has(n)) types.set(n, t);
		}
		const missing = new Set<string>();
		for (const [name, type] of types) {
			if (type === "boolean") continue;
			const v = paramValues[name];
			if (v === undefined || v === "") missing.add(name);
		}
		if (missing.size > 0) {
			setMissingParams(missing);
			Utils.toastError(
				"Missing parameters",
				`Please provide values for: ${Array.from(missing).join(", ")}`,
			);
			return;
		}
		setMissingParams(new Set());
		handleExpandResult();
		m.mutate();
	}, [
		library.parameter,
		inheritedTypes,
		paramValues,
		setMissingParams,
		handleExpandResult,
	]);

	React.useEffect(() => {
		triggerRunRef.current = triggerRun;
	}, [triggerRun, triggerRunRef]);

	React.useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				triggerRun();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [triggerRun]);

	const editorContent = (
		<div className="flex flex-col h-full">
			<EditorHeaderMenu
				onRun={triggerRun}
				onSave={() => saveMutation.mutate()}
				isRunDisabled={runMutation.isPending}
				isSaveDisabled={saveMutation.isPending}
			/>
			<div className="flex-1 min-h-0 overflow-auto">
				<div className="min-h-full bg-bg-primary px-2.5 pt-3 pb-[250px]">
					<PropertiesTree />
				</div>
			</div>
		</div>
	);

	const hasResult = runResult !== null || isRunning || runError !== null;

	if (!hasResult) {
		return (
			<div className="relative h-full grow min-h-0 flex flex-col">
				{editorContent}
			</div>
		);
	}

	if (isResultCollapsed) {
		return (
			<div className="relative h-full grow min-h-0 flex flex-col overflow-hidden">
				<div className="flex-1 min-h-0">{editorContent}</div>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-t h-10 flex-none">
					<span className="typo-label text-text-secondary">Result</span>
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={handleToggleCollapse}
							>
								<PanelBottomOpen className="w-4 h-4" />
							</HSComp.Button>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent align="end">Restore</HSComp.TooltipContent>
					</HSComp.Tooltip>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-full grow min-h-0 flex flex-col overflow-hidden">
			<HSComp.ResizablePanelGroup
				direction="vertical"
				autoSaveId="sqlquery-builder-vertical"
				className="grow min-h-0"
			>
				<HSComp.ResizablePanel minSize={20}>
					{editorContent}
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle />
				<HSComp.ResizablePanel defaultSize={30} minSize={10}>
					<div
						className={`flex flex-col h-full ${isMaximized ? "absolute top-0 bottom-0 h-full w-full left-0 z-30 overflow-auto bg-bg-primary" : ""}`}
					>
						<div className="flex-1 min-h-0">
							<ResultPanel
								isMaximized={isMaximized}
								onToggleMaximize={handleToggleMaximize}
								onToggleCollapse={handleToggleCollapse}
							/>
						</div>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
}
