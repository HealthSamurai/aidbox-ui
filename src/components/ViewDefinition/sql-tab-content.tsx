import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import { CodeEditor } from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Constants from "./constants";
import { ViewDefinitionContext } from "./page";

const fetchSQL = async (
	client: AidboxClientR5,
	viewDefinition: ViewDefinition,
): Promise<string> => {
	const parametersPayload = {
		resourceType: "Parameters",
		parameter: [
			{
				name: "viewResource",
				resource: viewDefinition,
			},
		],
	};

	const response = await client.rawRequest({
		method: "POST",
		url: "/fhir/ViewDefinition/$sql",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/fhir+json",
		},
		body: JSON.stringify(parametersPayload),
	});

	const json = await response.response.json();
	if (json.issue) {
		throw Error(`${json.issue[0]?.diagnostics || "Unknown error"}`);
	}

	const value = json.parameter[0]?.valueString;
	if (!value) throw Error("No SQL in response");

	return formatSQL(value, {
		language: "postgresql",
		keywordCase: "upper",
		linesBetweenQueries: 2,
	});
};

export function SQLTab() {
	const client = useAidboxClient();

	const viewDefinitionContext = useContext(ViewDefinitionContext);

	// Snapshot at mount time — the component remounts on each tab switch
	// (no forceMount), so this always reflects the latest state on entry.
	const [viewDefinition] = useState(() => viewDefinitionContext.viewDefinition);

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinition, Constants.PageID, "sql-tab"],
		queryFn: async () => {
			if (!viewDefinition) return "";
			return await fetchSQL(client, viewDefinition);
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	return (
		<>
			{isLoading ? (
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">Loading SQL...</div>
						<div className="text-sm">
							Generating SQL query from ViewDefinition
						</div>
					</div>
				</div>
			) : status === "error" ? (
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">Error loading SQL...</div>
						<div className="text-sm">{error.message}</div>
					</div>
				</div>
			) : (
				<CodeEditor readOnly currentValue={data ?? ""} mode="sql" />
			)}
		</>
	);
}
