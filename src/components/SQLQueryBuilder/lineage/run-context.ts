import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import type { ParamSpec } from "./types";

export type LineageRunResult = {
	columns: string[];
	rows: unknown[][];
};

export type RunQueryArgs = {
	nodeId: string;
	queryId: string;
	allParams: ParamSpec[];
	paramValues: Record<string, string>;
};

export type LineageRunContextValue = {
	runningNodeId: string | null;
	resultNodeId: string | null;
	runResult: LineageRunResult | null;
	runError: HSComp.OperationOutcome | null;
	runView: (nodeId: string, viewId: string) => void;
	runQuery: (args: RunQueryArgs) => void;
};

export const LineageRunContext =
	React.createContext<LineageRunContextValue | null>(null);

export function useLineageRunContext(): LineageRunContextValue {
	const ctx = React.useContext(LineageRunContext);
	if (!ctx) {
		throw new Error(
			"useLineageRunContext must be used within LineageRunContext.Provider",
		);
	}
	return ctx;
}
