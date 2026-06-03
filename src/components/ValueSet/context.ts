import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import type { ValueSet, ValueSetExpansion } from "./types";

export type ValueSetContextValue = {
	valueSet: ValueSet;
	updateValueSet: (updater: (vs: ValueSet) => ValueSet) => void;
	expansion: ValueSetExpansion | null;
	setExpansion: (e: ValueSetExpansion | null) => void;
	expandError: HSComp.OperationOutcome | null;
	setExpandError: (e: HSComp.OperationOutcome | null) => void;
	isExpanding: boolean;
	setIsExpanding: (b: boolean) => void;
	expandDurationMs: number | null;
	setExpandDurationMs: (n: number | null) => void;
};

export const ValueSetContext = React.createContext<ValueSetContextValue | null>(
	null,
);

export function useValueSetContext(): ValueSetContextValue {
	const ctx = React.useContext(ValueSetContext);
	if (!ctx) {
		throw new Error("useValueSetContext must be used within ValueSetProvider");
	}
	return ctx;
}
