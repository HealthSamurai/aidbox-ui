import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import type { SQLLibrary } from "./types";

export type RunResult = {
	columns: string[];
	rows: unknown[][];
};

export type SQLQueryContextValue = {
	library: SQLLibrary;
	updateLibrary: (updater: (lib: SQLLibrary) => SQLLibrary) => void;
	isDirty: boolean;
	setIsDirty: (dirty: boolean) => void;
	runResult: RunResult | null;
	setRunResult: (result: RunResult | null) => void;
	runError: HSComp.OperationOutcome | null;
	setRunError: (error: HSComp.OperationOutcome | null) => void;
	isRunning: boolean;
	setIsRunning: (running: boolean) => void;
	paramValues: Record<string, string>;
	setParamValue: (name: string, value: string) => void;
	onCreated?: (id: string) => void;
	onDeleted?: () => void;
};

export const SQLQueryContext = React.createContext<SQLQueryContextValue | null>(
	null,
);

export function useSQLQueryContext(): SQLQueryContextValue {
	const ctx = React.useContext(SQLQueryContext);
	if (!ctx) {
		throw new Error("useSQLQueryContext must be used within SQLQueryProvider");
	}
	return ctx;
}
