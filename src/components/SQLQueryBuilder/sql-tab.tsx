import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { format as formatSQL } from "sql-formatter";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useSQLQueryContext } from "./context";
import { useResolvedParameterTree } from "./resolve-tree";
import { buildRunPayload } from "./run-payload";
import type { SQLLibrary } from "./types";

type DebugResponse = {
	sql?: string;
	params?: unknown[];
};

async function fetchDebugSQL(
	client: AidboxClientR5,
	library: SQLLibrary,
	inheritedTypes: Map<string, string>,
	paramValues: Record<string, string>,
): Promise<{ sql: string; params: unknown[] }> {
	const body = buildRunPayload(library, inheritedTypes, paramValues);
	const response = await client.rawRequest({
		method: "POST",
		url: "/fhir/$sqlquery-run?__debug=true",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const json = (await response.response.json()) as DebugResponse & {
		issue?: Array<{ diagnostics?: string }>;
	};
	if (!response.response.ok) {
		const diagnostics = json.issue?.[0]?.diagnostics ?? "Unknown error";
		throw new Error(diagnostics);
	}
	if (json.issue) {
		throw new Error(json.issue[0]?.diagnostics ?? "Unknown error");
	}
	if (!json.sql) {
		throw new Error("No SQL in response");
	}
	return { sql: json.sql, params: json.params ?? [] };
}

type FhirParam = { "fhir-type"?: string; values?: unknown[] };

function isFhirParam(p: unknown): p is FhirParam {
	return (
		typeof p === "object" &&
		p !== null &&
		"values" in p &&
		Array.isArray((p as { values: unknown }).values)
	);
}

function escapeStringLiteral(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

function formatScalar(value: unknown, fhirType?: string): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") {
		if (fhirType === "integer" || fhirType === "decimal") return value;
		if (fhirType === "boolean") return value.toUpperCase();
		return escapeStringLiteral(value);
	}
	return escapeStringLiteral(JSON.stringify(value));
}

function formatParam(p: unknown): string {
	if (!isFhirParam(p)) return formatScalar(p);
	const fhirType = p["fhir-type"];
	const values = p.values ?? [];
	if (values.length === 0) return "NULL";
	if (values.length === 1) return formatScalar(values[0], fhirType);
	return `(${values.map((v) => formatScalar(v, fhirType)).join(", ")})`;
}

function inlineParams(sql: string, params: unknown[]): string {
	let result = "";
	let paramIdx = 0;
	let inString = false;
	let i = 0;
	while (i < sql.length) {
		const ch = sql[i];
		if (inString) {
			result += ch;
			if (ch === "'" && sql[i + 1] === "'") {
				result += "'";
				i += 2;
				continue;
			}
			if (ch === "'") inString = false;
			i++;
			continue;
		}
		if (ch === "'") {
			inString = true;
			result += ch;
			i++;
			continue;
		}
		if (ch === "?" && paramIdx < params.length) {
			result += formatParam(params[paramIdx]);
			paramIdx++;
			i++;
			continue;
		}
		result += ch;
		i++;
	}
	return result;
}

function formatDebugOutput(sql: string, params: unknown[]): string {
	const inlined = inlineParams(sql, params);
	try {
		return formatSQL(inlined, {
			language: "postgresql",
			indentStyle: "tabularRight",
			keywordCase: "upper",
		});
	} catch {
		return inlined;
	}
}

export function SQLTab() {
	const client = useAidboxClient();
	const { library, paramValues } = useSQLQueryContext();
	const { tree } = useResolvedParameterTree(library);
	const inheritedTypes = React.useMemo(() => {
		const m = new Map<string, string>();
		for (const p of tree.inherited) {
			if (!m.has(p.name)) m.set(p.name, p.type ?? "string");
		}
		return m;
	}, [tree.inherited]);

	const [snapshot] = React.useState(() => ({
		library,
		paramValues,
		inheritedTypes,
	}));

	const { isLoading, data, status, error } = useQuery({
		queryKey: ["sqlquery-debug-sql", snapshot.library],
		queryFn: () =>
			fetchDebugSQL(
				client,
				snapshot.library,
				snapshot.inheritedTypes,
				snapshot.paramValues,
			),
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading SQL...</div>
					<div className="text-sm">Generating SQL query from SQLQuery</div>
				</div>
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Error loading SQL</div>
					<div className="text-sm text-text-error-primary">
						{error instanceof Error ? error.message : String(error)}
					</div>
					<div className="text-sm mt-2">
						The SQLQuery resource may be invalid. Fix the resource and try
						again.
					</div>
				</div>
			</div>
		);
	}

	const text = data ? formatDebugOutput(data.sql, data.params) : "";
	return <HSComp.CodeEditor readOnly currentValue={text} mode="sql" />;
}
