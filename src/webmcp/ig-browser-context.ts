import { createContext, use } from "react";

export interface IGBrowserPackage {
	name: string;
	version: string;
	tags: string[];
}

export interface IGBrowserActions {
	listPackages: (query?: string) => IGBrowserPackage[];
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
