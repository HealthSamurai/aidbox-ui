import * as React from "react";
import type { CodeSystem } from "./types";

export type CodeSystemContextValue = {
	codeSystem: CodeSystem;
	updateCodeSystem: (updater: (cs: CodeSystem) => CodeSystem) => void;
	missingFields: Set<string>;
	setMissingFields: React.Dispatch<React.SetStateAction<Set<string>>>;
	isDirty: boolean;
	setIsDirty: (value: boolean) => void;
};

export const CodeSystemContext =
	React.createContext<CodeSystemContextValue | null>(null);

export function useCodeSystemContext(): CodeSystemContextValue {
	const ctx = React.useContext(CodeSystemContext);
	if (!ctx) {
		throw new Error(
			"useCodeSystemContext must be used within CodeSystemProvider",
		);
	}
	return ctx;
}
