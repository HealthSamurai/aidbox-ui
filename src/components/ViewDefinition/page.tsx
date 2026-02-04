import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import * as Constants from "./constants";
import { EditorPanelContent } from "./editor-panel-content";
import { InfoPanel } from "./info-panel";
import { ResultPanel } from "./result-panel-content";
import type * as Types from "./types";

const fetchViewDefinition = (client: AidboxClientR5, id: string) => {
	return client.read<ViewDefinition>({
		type: "ViewDefinition",
		id: id,
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
		isDirty: false,
		setIsDirty: () => {},
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
	const [viewDefinition, setViewDefinition] = React.useState<ViewDefinition>();
	const [runViewDefinition, setRunViewDefinition] =
		React.useState<ViewDefinition>();

	const [runResult, setRunResult] = React.useState<string>();
	const [runResultPage, setRunResultPage] = React.useState(1);
	const [runResultPageSize, setRunResultPageSize] = React.useState(30);
	const [isDirty, setIsDirty] = React.useState(false);

	const { proceed, reset, status } = useBlocker({
		shouldBlockFn: ({ current, next }) => {
			if (!isDirty) return false;
			if (current.pathname === next.pathname) return false;
			return true;
		},
		enableBeforeUnload: () => isDirty,
		withResolver: true,
	});

	const viewDefinitionQuery = useQuery({
		queryKey: [Constants.PageID, id],
		queryFn: async () => {
			const viewDefinitionPlaceholder: ViewDefinition = {
				resource: "Patient",
				resourceType: "ViewDefinition",
				status: "draft",
				select: [],
			};
			let response: ViewDefinition = viewDefinitionPlaceholder;
			if (id) {
				const result = await fetchViewDefinition(aidboxClient, id);
				if (result.isErr()) {
					throw new Error(
						Utils.parseOperationOutcome(result.value.resource)
							.map(
								({ expression, diagnostics }) =>
									`${expression}: ${diagnostics}`,
							)
							.join("; "),
						{ cause: result.value.resource },
					);
				}
				response = result.value.resource;
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
				isDirty: isDirty,
				setIsDirty: setIsDirty,
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

			<HSComp.AlertDialog open={status === "blocked"}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Unsaved changes</HSComp.AlertDialogTitle>
						<HSComp.AlertDialogDescription>
							You have unsaved changes. Are you sure you want to leave this
							page? Your changes will be lost.
						</HSComp.AlertDialogDescription>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel onClick={reset}>
							Cancel
						</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={proceed}
						>
							Leave
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</ViewDefinitionContext.Provider>
	);
};

export default ViewDefinitionPage;
