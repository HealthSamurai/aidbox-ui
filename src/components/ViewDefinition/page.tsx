import type * as AidboxType from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Constants from "./constants";
import { EditorPanelContent } from "./editor-panel-content";
import { InfoPanel } from "./info-panel";
import { ResultPanel } from "./result-panel-content";
import type * as Types from "./types";

const fetchViewDefinition = (client: AidboxType.Client, id: string) => {
	return client.aidboxRequest<Types.ViewDefinition>({
		method: "GET",
		url: `/fhir/ViewDefinition/${id}`,
	});
};

export const ViewDefinitionContext =
	React.createContext<Types.ViewDefinitionContextProps>({
		viewDefinition: undefined,
		setViewDefinition: () => {},
		isLoadingViewDef: true,
		runResult: undefined,
		setRunResult: () => {},
		runResultPageSize: 30,
		setRunResultPageSize: () => {},
		runResultPage: 1,
		setRunResultPage: () => {},
		runViewDefinition: undefined,
		setRunViewDefinition: () => {},
	});

export const ViewDefinitionResourceTypeContext =
	React.createContext<Types.ViewDefinitionResourceTypeContextProps>({
		viewDefinitionResourceType: undefined,
		setViewDefinitionResourceType: () => {},
	});

export const ViewDefinitionErrorPage = ({
	viewDefinitionError,
}: {
	viewDefinitionError: Error;
}) => {
	return (
		<div className="px-4 py-5">
			<div className="text-text-secondary">
				Error while fetching View Definition:
			</div>
			<div className="text-text-error-primary">
				{viewDefinitionError.message}
			</div>
		</div>
	);
};

const ViewDefinitionPage = ({ id }: { id?: string }) => {
	const aidboxClient = useAidboxClient();

	const [resouceTypeForViewDefinition, setResouceTypeForViewDefinition] =
		React.useState<string>();
	const [viewDefinition, setViewDefinition] =
		React.useState<Types.ViewDefinition>();
	const [runViewDefinition, setRunViewDefinition] =
		React.useState<Types.ViewDefinition>();

	const [runResult, setRunResult] = React.useState<string>();
	const [runResultPage, setRunResultPage] = React.useState(1);
	const [runResultPageSize, setRunResultPageSize] = React.useState(30);

	const viewDefinitionQuery = useQuery({
		queryKey: [Constants.PageID, id],
		queryFn: async () => {
			const viewDefinitionPlaceholder = {
				resource: "Patient",
				resourceType: "ViewDefinition",
				select: [],
			};
			let response: Types.ViewDefinition = viewDefinitionPlaceholder;
			if (id) {
				const resp = await fetchViewDefinition(aidboxClient, id);
				response = resp.response.body;
			}
			setResouceTypeForViewDefinition(response.resource);
			setViewDefinition(response);
			return response;
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (viewDefinitionQuery.error)
		return (
			<ViewDefinitionErrorPage
				viewDefinitionError={viewDefinitionQuery.error}
			/>
		);

	return (
		<ViewDefinitionContext.Provider
			value={{
				originalId: id,
				viewDefinition: viewDefinition,
				setViewDefinition: setViewDefinition,
				isLoadingViewDef: viewDefinitionQuery.isLoading,
				runResult: runResult,
				setRunResult: setRunResult,
				runResultPage: runResultPage,
				setRunResultPage: setRunResultPage,
				runResultPageSize: runResultPageSize,
				setRunResultPageSize: setRunResultPageSize,
				runViewDefinition: runViewDefinition,
				setRunViewDefinition: setRunViewDefinition,
			}}
		>
			<ViewDefinitionResourceTypeContext.Provider
				value={{
					viewDefinitionResourceType: resouceTypeForViewDefinition,
					setViewDefinitionResourceType: setResouceTypeForViewDefinition,
				}}
			>
				<HSComp.ResizablePanelGroup
					direction="vertical"
					autoSaveId="view-definition-vertical-panel"
				>
					<HSComp.ResizablePanel minSize={10}>
						<HSComp.ResizablePanelGroup
							direction="horizontal"
							autoSaveId="view-definition-horizontal-panel"
						>
							<HSComp.ResizablePanel minSize={20}>
								<EditorPanelContent />
							</HSComp.ResizablePanel>
							<HSComp.ResizableHandle />
							<HSComp.ResizablePanel minSize={20}>
								<InfoPanel />
							</HSComp.ResizablePanel>
						</HSComp.ResizablePanelGroup>
					</HSComp.ResizablePanel>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel minSize={10}>
						<ResultPanel />
					</HSComp.ResizablePanel>
				</HSComp.ResizablePanelGroup>
			</ViewDefinitionResourceTypeContext.Provider>
		</ViewDefinitionContext.Provider>
	);
};

export default ViewDefinitionPage;
