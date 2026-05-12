import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { type RunResult, SQLQueryContext } from "./context";
import type { SQLLibrary } from "./types";

export function SQLQueryProvider({
	initialResource,
	children,
}: {
	initialResource: Resource;
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
	const [paramValues, setParamValues] = React.useState<Record<string, string>>(
		{},
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

	const setParamValue = React.useCallback((name: string, value: string) => {
		setParamValues((prev) => ({ ...prev, [name]: value }));
	}, []);

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
			}}
		>
			{children}
		</SQLQueryContext.Provider>
	);
}
