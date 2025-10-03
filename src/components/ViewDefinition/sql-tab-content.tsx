import { CodeEditor, TabsContent } from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { format as formatSQL } from "sql-formatter";
import { AidboxCallWithMeta } from "../../api/auth";
import * as Constants from "./constants";
import { ViewDefinitionContext } from "./page";
import type { ViewDefinition } from "./types";

const fetchSQL = async (viewDefinition: ViewDefinition): Promise<string> => {
	const parametersPayload = {
		resourceType: "Parameters",
		parameter: [
			{
				name: "viewResource",
				resource: viewDefinition,
			},
		],
	};

	const response = await AidboxCallWithMeta({
		method: "POST",
		url: "/fhir/ViewDefinition/$sql",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/fhir+json",
		},
		body: JSON.stringify(parametersPayload),
	});

	const json = JSON.parse(response.body);
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
	const viewDefinitionContext = useContext(ViewDefinitionContext);

	const viewDefinition = viewDefinitionContext.viewDefinition;

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinition, Constants.PageID, "sql-tab"],
		queryFn: async () => {
			if (!viewDefinition) return "";
			return await fetchSQL(viewDefinition);
		},
		retry: false,
	});

	return (
		<TabsContent value="sql" className="grow min-h-0">
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
				<CodeEditor readOnly currentValue={data} mode="sql" />
			)}
		</TabsContent>
	);
}
