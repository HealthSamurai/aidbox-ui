import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useBlocker } from "@tanstack/react-router";
import * as React from "react";
import { ValueSetContext } from "./context";
import type { ValueSet, ValueSetExpansion } from "./types";
import { computeValueSetHash } from "./valueset-hash";

export function ValueSetProvider({
	initialResource,
	children,
}: {
	initialResource: Resource;
	children: React.ReactNode;
}) {
	const [valueSet, setValueSet] = React.useState<ValueSet>(() => {
		const vs = initialResource as ValueSet;
		if (vs.id) return vs;
		const patch: Partial<ValueSet> = {};
		if (!vs.version) patch.version = "1.0.0";
		if (!vs.status) patch.status = "draft";
		return Object.keys(patch).length > 0 ? { ...vs, ...patch } : vs;
	});
	const valueSetRef = React.useRef(valueSet);
	valueSetRef.current = valueSet;

	const updateValueSet = React.useCallback(
		(updater: (vs: ValueSet) => ValueSet) => {
			setValueSet((prev) => updater(prev));
		},
		[],
	);

	const [baselineHash, setBaselineHash] = React.useState<string>(() =>
		computeValueSetHash(valueSet),
	);
	const isDeletedRef = React.useRef(false);
	const isDirty =
		!isDeletedRef.current && computeValueSetHash(valueSet) !== baselineHash;
	const isDirtyRef = React.useRef(false);
	isDirtyRef.current = isDirty;

	const setIsDirty = React.useCallback((value: boolean) => {
		if (!value) {
			setBaselineHash(computeValueSetHash(valueSetRef.current));
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

	const [expansion, setExpansion] = React.useState<ValueSetExpansion | null>(
		null,
	);
	const [expandError, setExpandError] =
		React.useState<HSComp.OperationOutcome | null>(null);
	const [isExpanding, setIsExpanding] = React.useState(false);
	const [expandDurationMs, setExpandDurationMs] = React.useState<number | null>(
		null,
	);
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
		<ValueSetContext.Provider
			value={{
				valueSet,
				updateValueSet,
				expansion,
				setExpansion,
				expandError,
				setExpandError,
				isExpanding,
				setIsExpanding,
				expandDurationMs,
				setExpandDurationMs,
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
		</ValueSetContext.Provider>
	);
}
