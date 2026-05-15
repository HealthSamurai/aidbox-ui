import * as React from "react";

export type ExpandContextValue = {
	expandingNodeId: string | null;
	expand: (queryNodeId: string) => void;
};

export const ExpandContext = React.createContext<ExpandContextValue | null>(
	null,
);

export function useExpandContext(): ExpandContextValue {
	const ctx = React.useContext(ExpandContext);
	if (!ctx) {
		throw new Error(
			"useExpandContext must be used within ExpandContext.Provider",
		);
	}
	return ctx;
}
