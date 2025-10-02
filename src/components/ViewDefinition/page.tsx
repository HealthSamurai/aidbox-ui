import * as HSComp from "@health-samurai/react-components";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import React, { useCallback } from "react";
import { AidboxCall } from "../../api/auth";
import * as Constants from "./constants";
import { EditorPanelContent } from "./editor-panel-content";
import { InfoPanel } from "./info-panel";
import type * as Types from "./types";

const fetchViewDefinition = (id: string) => {
	return AidboxCall<Types.ViewDefinition>({
		method: "GET",
		url: `/fhir/ViewDefinition/${id}`,
	});
};

export const ViewDefinitionContext =
	React.createContext<Types.ViewDefinitionContextProps>({
		viewDefinition: undefined,
		setViewDefinition: () => {},
		isLoadingViewDef: true,
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

const ViewDefinitionPage = ({ id }: { id: string }) => {
	const [viewDefinition, setViewDefinition] =
		React.useState<Types.ViewDefinition>();

	const [viewDefinitionResourceType, setViewDefinitionResourceType] =
		React.useState<string>();

	const viewDefinitionQuery = useQuery({
		queryKey: [Constants.PageID, id],
		queryFn: async () => {
			const response = await fetchViewDefinition(id);
			setViewDefinition(response);
			setViewDefinitionResourceType(response.resource);
			return response;
		},
		retry: false,
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
				viewDefinition: viewDefinition,
				setViewDefinition: setViewDefinition,
				isLoadingViewDef: viewDefinitionQuery.isLoading,
				originalId: id,
			}}
		>
			<ViewDefinitionResourceTypeContext.Provider
				value={{
					viewDefinitionResourceType: viewDefinitionResourceType,
					setViewDefinitionResourceType: setViewDefinitionResourceType,
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
						<div>Bottom Panel</div>
					</HSComp.ResizablePanel>
				</HSComp.ResizablePanelGroup>
			</ViewDefinitionResourceTypeContext.Provider>
		</ViewDefinitionContext.Provider>
	);
};

export default ViewDefinitionPage;
