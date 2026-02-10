import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import type {
	OperationOutcome,
	OperationOutcomeIssue,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useBlocker } from "@tanstack/react-router";
import React from "react";
import type * as Types from "./types";

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
		runError: undefined,
		setRunError: () => {},
		issueClickRef: { current: undefined },
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

export const ViewDefinitionProvider = ({
	id,
	initialResource,
	children,
}: {
	id?: string;
	initialResource: Resource;
	children: React.ReactNode;
}) => {
	const [resourceTypeForVD, setResourceTypeForVD] = React.useState<
		string | undefined
	>((initialResource as ViewDefinition).resource);
	const [viewDefinition, setViewDefinition] = React.useState<ViewDefinition>(
		initialResource as ViewDefinition,
	);
	const [runViewDefinition, setRunViewDefinition] =
		React.useState<ViewDefinition>();
	const [runResult, setRunResult] = React.useState<string>();
	const [runResultPage, setRunResultPage] = React.useState(1);
	const [runResultPageSize, setRunResultPageSize] = React.useState(30);
	const [runError, setRunError] = React.useState<OperationOutcome>();
	const issueClickRef = React.useRef<
		((issue: OperationOutcomeIssue) => void) | undefined
	>(undefined);
	const [isDirty, _setIsDirty] = React.useState(false);
	const isDirtyRef = React.useRef(false);
	const setIsDirty = React.useCallback(
		(value: boolean | ((prev: boolean) => boolean)) => {
			_setIsDirty((prev) => {
				const next = typeof value === "function" ? value(prev) : value;
				isDirtyRef.current = next;
				return next;
			});
		},
		[],
	);

	const { proceed, reset, status } = useBlocker({
		shouldBlockFn: ({ current, next }) => {
			if (!isDirtyRef.current) return false;
			if (current.pathname === next.pathname) return false;
			return true;
		},
		enableBeforeUnload: () => isDirtyRef.current,
		withResolver: true,
	});

	return (
		<ViewDefinitionContext.Provider
			value={{
				originalId: id,
				viewDefinition,
				setViewDefinition,
				isLoadingViewDef: false,
				runResult,
				setRunResult,
				runResultPage,
				setRunResultPage,
				runResultPageSize,
				setRunResultPageSize,
				runViewDefinition,
				setRunViewDefinition,
				isDirty,
				setIsDirty,
				runError,
				setRunError,
				issueClickRef,
			}}
		>
			<ViewDefinitionResourceTypeContext.Provider
				value={{
					viewDefinitionResourceType: resourceTypeForVD,
					setViewDefinitionResourceType: setResourceTypeForVD,
				}}
			>
				{children}
			</ViewDefinitionResourceTypeContext.Provider>

			<HSComp.AlertDialog open={status === "blocked"}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Unsaved changes</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						You have unsaved changes. Are you sure you want to leave this page?
						Your changes will be lost.
					</HSComp.AlertDialogDescription>
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
