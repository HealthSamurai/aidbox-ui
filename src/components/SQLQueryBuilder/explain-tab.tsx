import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { psqlRequest } from "../db-console/tables-view";
import { useSQLQueryContext } from "./context";
import { useResolvedParameterTree } from "./resolve-tree";
import { fetchDebugSQL, inlineParams } from "./sql-tab";

/** EXPLAIN prints one row per plan line, under a single column. */
function planText(rows: Record<string, unknown>[]): string {
	return rows
		.map((row) => {
			const first = Object.values(row)[0];
			return first === null || first === undefined ? "" : String(first);
		})
		.join("\n");
}

export function ExplainTab() {
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

	// Snapshot on mount, as the SQL tab does: the tab explains the query as it
	// stood when opened, not as it changes under the cursor.
	const [snapshot] = React.useState(() => ({
		library,
		paramValues,
		inheritedTypes,
	}));

	const { isLoading, data, status, error } = useQuery({
		queryKey: ["sqlquery-builder-explain", snapshot.library],
		queryFn: async () => {
			const { sql, params } = await fetchDebugSQL(
				client,
				snapshot.library,
				snapshot.inheritedTypes,
				snapshot.paramValues,
			);
			// The compiled SQL carries `?` placeholders and $psql takes no
			// parameters, so the values are inlined first.
			const rows = await psqlRequest<Record<string, unknown>>(
				client,
				`EXPLAIN ${inlineParams(sql, params)}`,
				{ readOnly: true },
			);
			return planText(rows);
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading plan...</div>
					<div className="text-sm">Running EXPLAIN</div>
				</div>
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Error running explain</div>
					<div className="text-sm text-text-error-primary">
						{error instanceof Error ? error.message : String(error)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto bg-bg-primary">
			<pre className="p-4 typo-code text-text-primary whitespace-pre">
				{data}
			</pre>
		</div>
	);
}
