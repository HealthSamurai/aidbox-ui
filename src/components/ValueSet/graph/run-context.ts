import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import type { ValueSetExpansionContains } from "../types";

export type ExpandTarget = {
	kind: "expand";
	nodeId: string;
	isRoot: boolean;
	url?: string;
	version?: string;
};

export type ContentTarget = {
	kind: "content";
	nodeId: string;
	csId?: string;
	url?: string;
	version?: string;
};

export type RunTarget = ExpandTarget | ContentTarget;

export type ConceptRow = {
	code: string;
	display?: string;
	definition?: string;
	parent?: string;
	depth: number;
};

export type ExpandRunResult = {
	kind: "expand";
	contains: ValueSetExpansionContains[];
	total?: number;
	durationMs: number;
};

export type ContentRunResult = {
	kind: "content";
	rows: ConceptRow[];
	durationMs: number;
};

export type GraphRunResult = ExpandRunResult | ContentRunResult;

export type GraphRunContextValue = {
	runningNodeId: string | null;
	resultNodeId: string | null;
	result: GraphRunResult | null;
	error: HSComp.OperationOutcome | null;
	run: (target: RunTarget) => void;
};

export const GraphRunContext = React.createContext<GraphRunContextValue | null>(
	null,
);

export function useGraphRunContext(): GraphRunContextValue {
	const ctx = React.useContext(GraphRunContext);
	if (!ctx) {
		throw new Error(
			"useGraphRunContext must be used within GraphRunContext.Provider",
		);
	}
	return ctx;
}
