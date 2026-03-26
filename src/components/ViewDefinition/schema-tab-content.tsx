import {
	FhirStructureView,
	TabsContent,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { useAidboxClient } from "../../AidboxClient";
import { fetchProfileElements, fetchSchemas } from "../../api/schemas";
import { transformSnapshotToTree } from "../../utils";
import * as Constants from "./constants";
import { ViewDefinitionResourceTypeContext } from "./page";

export function SchemaTabContent() {
	const client = useAidboxClient();

	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);
	const viewDefinitionResourceType =
		viewDefinitionTypeContext.viewDefinitionResourceType;

	const { data: schemas } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID, "schemas"],
		queryFn: () => {
			if (!viewDefinitionResourceType) return undefined;
			return fetchSchemas(client, viewDefinitionResourceType);
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	const defaultSchema = schemas
		? Object.values(schemas).find((s) => s["default?"] === true)
		: undefined;

	const { isLoading, data, status, error } = useQuery({
		queryKey: [
			viewDefinitionResourceType,
			Constants.PageID,
			"snapshot",
			defaultSchema?.["package-coordinate"],
			defaultSchema?.entity?.url,
		],
		queryFn: () => {
			const coord = defaultSchema?.["package-coordinate"];
			const url = defaultSchema?.entity?.url;
			if (!coord || !url) return Promise.resolve(undefined);
			return fetchProfileElements(
				client,
				"aidbox.introspector/get-profile-snapshot",
				coord,
				url,
			);
		},
		enabled:
			!!defaultSchema?.["package-coordinate"] && !!defaultSchema?.entity?.url,
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
