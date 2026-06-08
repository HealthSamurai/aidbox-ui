import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as React from "react";
import { ConceptMapContext } from "./context";
import type { ConceptMap } from "./types";

export function ConceptMapProvider({
	initialResource,
	children,
}: {
	initialResource: Resource;
	children: React.ReactNode;
}) {
	const [conceptMap, setConceptMap] = React.useState<ConceptMap>(() => {
		const cm = initialResource as ConceptMap;
		if (cm.id) return cm;
		const patch: Partial<ConceptMap> = {};
		if (!cm.version) patch.version = "1.0.0";
		if (!cm.status) patch.status = "draft";
		return Object.keys(patch).length > 0 ? { ...cm, ...patch } : cm;
	});

	const updateConceptMap = React.useCallback(
		(updater: (cm: ConceptMap) => ConceptMap) => {
			setConceptMap((prev) => updater(prev));
		},
		[],
	);

	return (
		<ConceptMapContext.Provider value={{ conceptMap, updateConceptMap }}>
			{children}
		</ConceptMapContext.Provider>
	);
}
