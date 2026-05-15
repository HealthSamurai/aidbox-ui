import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useBlocker } from "@tanstack/react-router";
import * as React from "react";
import { type RunResult, SQLQueryContext } from "./context";
import { computeLibraryHash } from "./library-hash";
import type { SQLLibrary } from "./types";

function paramStorageKey(lib: SQLLibrary): string {
	const id = lib.id || lib.url || "new";
	return `sqlquery-builder:param-values:${id}`;
}

function readStoredParamValues(key: string): Record<string, string> {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			return parsed as Record<string, string>;
		}
	} catch {
		// ignore
	}
	return {};
}

export function SQLQueryProvider({
	initialResource,
	onCreated,
	onDeleted,
	children,
}: {
	initialResource: Resource;
	onCreated?: (id: string) => void;
	onDeleted?: () => void;
	children: React.ReactNode;
}) {
	const [library, setLibrary] = React.useState<SQLLibrary>(
		initialResource as SQLLibrary,
	);
	const libraryRef = React.useRef(library);
	libraryRef.current = library;

	const [baselineHash, setBaselineHash] = React.useState<string>(() =>
		computeLibraryHash(initialResource as SQLLibrary),
	);
	const isDirty = computeLibraryHash(library) !== baselineHash;
	const isDirtyRef = React.useRef(false);
	isDirtyRef.current = isDirty;

	const setIsDirty = React.useCallback((value: boolean) => {
		if (!value) {
			setBaselineHash(computeLibraryHash(libraryRef.current));
		}
	}, []);
	const [runResult, setRunResult] = React.useState<RunResult | null>(null);
	const [runError, setRunError] =
		React.useState<HSComp.OperationOutcome | null>(null);
	const [isRunning, setIsRunning] = React.useState(false);
	const [missingParams, setMissingParams] = React.useState<Set<string>>(
		() => new Set(),
	);
	const triggerRunRef = React.useRef<() => void>(() => {});
	const paramStorageKeyRef = React.useRef(paramStorageKey(library));
	paramStorageKeyRef.current = paramStorageKey(library);
	const [paramValues, setParamValues] = React.useState<Record<string, string>>(
		() => readStoredParamValues(paramStorageKeyRef.current),
	);
	const paramValuesRef = React.useRef(paramValues);
	paramValuesRef.current = paramValues;

	const updateLibrary = React.useCallback(
		(updater: (lib: SQLLibrary) => SQLLibrary) => {
			setLibrary((prev) => updater(prev));
		},
		[],
	);

	const setParamValue = React.useCallback((name: string, value: string) => {
		setParamValues((prev) => ({ ...prev, [name]: value }));
	}, []);

	const persistParamValues = React.useCallback(() => {
		try {
			window.localStorage.setItem(
				paramStorageKeyRef.current,
				JSON.stringify(paramValuesRef.current),
			);
		} catch {
			// ignore
		}
	}, []);

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
		<SQLQueryContext.Provider
			value={{
				library,
				updateLibrary,
				isDirty,
				setIsDirty,
				runResult,
				setRunResult,
				runError,
				setRunError,
				isRunning,
				setIsRunning,
				paramValues,
				setParamValue,
				persistParamValues,
				missingParams,
				setMissingParams,
				triggerRunRef,
				onCreated,
				onDeleted,
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
		</SQLQueryContext.Provider>
	);
}
