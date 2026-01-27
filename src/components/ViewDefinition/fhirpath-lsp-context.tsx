import type { Extension } from "@codemirror/state";
import { useCodeMirrorLsp } from "@health-samurai/aidbox-fhirpath-lsp";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { ViewDefinitionResourceTypeContext } from "./page";

type FhirPathLspContextValue = {
	setContextType: (contextType: string | null) => void;
	/** Create a plugin for a specific file URI - each editor needs a unique URI */
	createPlugin: (fileUri: string) => Extension;
};

export const FhirPathLspContext = React.createContext<
	FhirPathLspContextValue | undefined
>(undefined);

export function FhirPathLspProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const client = useAidboxClient();
	const { viewDefinitionResourceType } = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const { setContextType, createPlugin } = useCodeMirrorLsp(client, {
		contextType: viewDefinitionResourceType ?? undefined,
		debug: false,
	});

	// Update context type when resource type changes
	React.useEffect(() => {
		setContextType(viewDefinitionResourceType ?? null);
	}, [viewDefinitionResourceType, setContextType]);

	const value = React.useMemo(
		() => ({
			setContextType,
			createPlugin,
		}),
		[setContextType, createPlugin],
	);

	return (
		<FhirPathLspContext.Provider value={value}>
			{children}
		</FhirPathLspContext.Provider>
	);
}

export function useFhirPathLsp(): FhirPathLspContextValue {
	const context = React.useContext(FhirPathLspContext);
	if (!context) {
		throw new Error("useFhirPathLsp must be used within FhirPathLspProvider");
	}
	return context;
}
