import * as React from "react";
import type { ConceptMap } from "./types";

export type ConceptMapContextValue = {
	conceptMap: ConceptMap;
	updateConceptMap: (updater: (cm: ConceptMap) => ConceptMap) => void;
};

export const ConceptMapContext =
	React.createContext<ConceptMapContextValue | null>(null);

export function useConceptMapContext(): ConceptMapContextValue {
	const ctx = React.useContext(ConceptMapContext);
	if (!ctx) {
		throw new Error(
			"useConceptMapContext must be used within ConceptMapProvider",
		);
	}
	return ctx;
}
