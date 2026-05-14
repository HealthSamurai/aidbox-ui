import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { type RunResult, SQLQueryContext } from "./context";
import type { SQLLibrary } from "./types";

function paramStorageKey(lib: SQLLibrary): string {
	const id = lib.id || lib.url || "new";
	return `sqlquery-builder:param-values:${id}`;
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
	const [isDirty, setIsDirty] = React.useState(false);
	const [runResult, setRunResult] = React.useState<RunResult | null>(null);
	const [runError, setRunError] =
		React.useState<HSComp.OperationOutcome | null>(null);
	const [isRunning, setIsRunning] = React.useState(false);
	const [missingParams, setMissingParams] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [paramValues, setParamValues] = useLocalStorage<Record<string, string>>(
		{
			key: paramStorageKey(library),
			defaultValue: {},
			getInitialValueInEffect: false,
		},
	);

	const updateLibrary = React.useCallback(
		(updater: (lib: SQLLibrary) => SQLLibrary) => {
			setLibrary((prev) => {
				const updated = updater(prev);
				return updated;
			});
			setIsDirty(true);
		},
		[],
	);

	const quietUpdateLibrary = React.useCallback(
		(updater: (lib: SQLLibrary) => SQLLibrary) => {
			setLibrary((prev) => updater(prev));
		},
		[],
	);

	const setParamValue = React.useCallback(
		(name: string, value: string) => {
			setParamValues((prev) => ({ ...prev, [name]: value }));
		},
		[setParamValues],
	);

	return (
		<SQLQueryContext.Provider
			value={{
				library,
				updateLibrary,
				quietUpdateLibrary,
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
				missingParams,
				setMissingParams,
				onCreated,
				onDeleted,
			}}
		>
			{children}
		</SQLQueryContext.Provider>
	);
}
