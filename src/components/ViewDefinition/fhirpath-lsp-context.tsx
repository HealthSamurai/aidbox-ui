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
	resourceType: explicitResourceType,
}: {
	children: React.ReactNode;
	/**
	 * When provided, overrides the resource type read from
	 * `ViewDefinitionResourceTypeContext`. Lets non-VD callers (e.g. the
	 * SearchParameter builder) wire an LSP provider with their own context.
	 */
	resourceType?: string;
}) {
	const client = useAidboxClient();
	const { viewDefinitionResourceType } = React.useContext(
		ViewDefinitionResourceTypeContext,
	);
	const effectiveResourceType =
		explicitResourceType ?? viewDefinitionResourceType ?? undefined;

	const { setContextType, createPlugin } = useCodeMirrorLsp(
		client as unknown as Parameters<typeof useCodeMirrorLsp>[0],
		{
			contextType: effectiveResourceType,
			debug: false,
		},
	);

	// Update context type when resource type changes
	React.useEffect(() => {
		setContextType(effectiveResourceType ?? null);
	}, [effectiveResourceType, setContextType]);

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
