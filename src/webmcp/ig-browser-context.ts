import { createContext, use } from "react";

export interface IGBrowserPackage {
	name: string;
	version: string;
	type: string;
}

export interface IGBrowserSort {
	column: "name" | "type";
	direction: "asc" | "desc";
}

export interface IGBrowserActions {
	listPackages: (query?: string) => IGBrowserPackage[];
	getSort: () => IGBrowserSort;
	sortPackages: (column: "name" | "type") => void;
	selectPackage: (id: string) => void;
	openInstallationPage: () => void;
}

export const IGBrowserActionsContext = createContext<IGBrowserActions | null>(
	null,
);

export const IGBrowserActionsProvider = IGBrowserActionsContext.Provider;

export function useIGBrowserActions(): IGBrowserActions | null {
	return use(IGBrowserActionsContext);
}
