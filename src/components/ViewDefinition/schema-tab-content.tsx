import {
	FhirStructureView,
	TabsContent,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { AidboxCallWithMeta } from "../../api/auth";
import { transformSnapshotToTree } from "../../utils";
import * as Constants from "./constants";
import { ViewDefinitionResourceTypeContext } from "./page";
import type { Snapshot } from "./types";

interface Schema {
	differential: Array<Snapshot>;
	snapshot: Array<Snapshot>;
	"default?": boolean;
}

interface SchemaData {
	result: Record<string, Schema>;
}

const fetchSchema = async (
	resourceType: string,
): Promise<Array<Snapshot> | undefined> => {
	const response = await AidboxCallWithMeta({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			method: "aidbox.introspector/get-schemas-by-resource-type",
			params: { "resource-type": resourceType },
		}),
	});

	const data: SchemaData = JSON.parse(response.body);

	if (!data?.result) return undefined;

	const defaultSchema = Object.values(data.result).find(
		(schema: Schema) => schema["default?"] === true,
	);

	return defaultSchema?.snapshot;
};

export function SchemaTabContent() {
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);
	const viewDefinitionResourceType =
		viewDefinitionTypeContext.viewDefinitionResourceType;

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID],
		queryFn: () => {
			if (!viewDefinitionResourceType) return;
			return fetchSchema(viewDefinitionResourceType);
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<TabsContent value="schema" className="h-full overflow-auto">
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">Loading schema...</div>
						<div className="text-sm">
							Fetching {viewDefinitionResourceType} schema
						</div>
					</div>
				</div>
			</TabsContent>
		);
	}

	if (status === "error") {
		return (
			<TabsContent value="schema" className="h-full overflow-auto">
				<div className="flex items-center justify-center h-full text-text-secondary">
					<div className="text-center">
						<div className="text-lg mb-2 text-red-600">
							Error loading schema
						</div>
						<div className="text-sm">{error.message}</div>
					</div>
				</div>
			</TabsContent>
		);
	}

	return (
		<TabsContent value="schema" className="h-full overflow-auto">
			<div className="h-full w-full overflow-auto px-2">
				<FhirStructureView tree={transformSnapshotToTree(data)} />
			</div>
		</TabsContent>
	);
}
