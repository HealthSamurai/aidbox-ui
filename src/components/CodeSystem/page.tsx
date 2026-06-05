import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useBlocker } from "@tanstack/react-router";
import * as React from "react";
import { computeCodeSystemHash } from "./codesystem-hash";
import { CodeSystemContext } from "./context";
import type { CodeSystem } from "./types";

export function CodeSystemProvider({
	initialResource,
	children,
}: {
	initialResource: Resource;
	children: React.ReactNode;
}) {
	const [codeSystem, setCodeSystem] = React.useState<CodeSystem>(() => {
		const cs = initialResource as CodeSystem;
		if (cs.id) return cs;
		const patch: Partial<CodeSystem> = {};
		if (!cs.version) patch.version = "1.0.0";
		if (!cs.status) patch.status = "draft";
		if (!cs.content) patch.content = "complete";
		return Object.keys(patch).length > 0 ? { ...cs, ...patch } : cs;
	});
	const codeSystemRef = React.useRef(codeSystem);
	codeSystemRef.current = codeSystem;

	const updateCodeSystem = React.useCallback(
		(updater: (cs: CodeSystem) => CodeSystem) => {
			setCodeSystem((prev) => updater(prev));
		},
		[],
	);

	const [baselineHash, setBaselineHash] = React.useState<string>(() =>
		computeCodeSystemHash(codeSystem),
	);
	const isDeletedRef = React.useRef(false);
	const isDirty =
		!isDeletedRef.current && computeCodeSystemHash(codeSystem) !== baselineHash;
	const isDirtyRef = React.useRef(false);
	isDirtyRef.current = isDirty;

	const setIsDirty = React.useCallback((value: boolean) => {
		if (!value) {
			setBaselineHash(computeCodeSystemHash(codeSystemRef.current));
			isDirtyRef.current = false;
		}
	}, []);

	React.useEffect(() => {
		const handler = () => {
			isDeletedRef.current = true;
			isDirtyRef.current = false;
		};
		window.addEventListener("aidbox-resource-deleted", handler);
		return () => window.removeEventListener("aidbox-resource-deleted", handler);
	}, []);

	const [missingFields, setMissingFields] = React.useState<Set<string>>(
		() => new Set(),
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
		<CodeSystemContext.Provider
			value={{
				codeSystem,
				updateCodeSystem,
				missingFields,
				setMissingFields,
				isDirty,
				setIsDirty,
			}}
		>
			{children}

			<HSComp.AlertDialog
				open={status === "blocked"}
				onOpenChange={(open) => {
					if (!open) reset?.();
				}}
			>
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
		</CodeSystemContext.Provider>
	);
}
