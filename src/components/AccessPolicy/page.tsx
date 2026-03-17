import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { useUnsavedChangesBlocker } from "../../hooks/useUnsavedChangesBlocker";

export interface AccessPolicyContextProps {
	accessPolicyId: string | undefined;
	accessPolicy: Resource | undefined;
	setAccessPolicy: (value: Resource) => void;
	isDirty: boolean;
	setIsDirty: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export const AccessPolicyContext =
	React.createContext<AccessPolicyContextProps>({
		accessPolicyId: undefined,
		accessPolicy: undefined,
		setAccessPolicy: () => {},
		isDirty: false,
		setIsDirty: () => {},
	});

export const AccessPolicyProvider = ({
	id,
	initialResource,
	children,
}: {
	id?: string;
	initialResource: Resource;
	children: React.ReactNode;
}) => {
	const [accessPolicy, setAccessPolicy] =
		React.useState<Resource>(initialResource);

	const { isDirty, setIsDirty, proceed, reset, status } =
		useUnsavedChangesBlocker();

	return (
		<AccessPolicyContext.Provider
			value={{
				accessPolicyId: id,
				accessPolicy,
				setAccessPolicy,
				isDirty,
				setIsDirty,
			}}
		>
			{children}

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
							onClick={() => {
								setIsDirty(false);
								proceed?.();
							}}
						>
							Leave
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</AccessPolicyContext.Provider>
	);
};
