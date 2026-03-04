import { createContext, use } from "react";

export interface DbConsoleTab {
	id: string;
	query: string;
	selected: boolean;
}

export interface HistoryEntry {
	command: string;
	timestamp: string;
}

export interface DbConsoleActions {
	executeQuery: (sql: string) => void;
	setQuery: (sql: string) => void;
	getQuery: () => string;
	runCurrentQuery: () => void;
	formatSql: () => void;
	getTabs: () => DbConsoleTab[];
	selectTab: (tabId: string) => void;
	selectTable: (schema: string, name: string) => void;
	openSidebar: () => void;
	openSidebarTab: (tab: "history" | "tables" | "queries") => void;
	expandResults: () => void;
	collapseResults: () => void;
	maximizeResults: () => void;
	minimizeResults: () => void;
	showExplain: (mode?: "visual" | "raw") => void;
	showResults: () => void;
	getHistory: (search?: string, limit?: number) => HistoryEntry[];
	openHistoryEntry: (query: string) => void;
}

export const DbConsoleActionsContext = createContext<DbConsoleActions | null>(
	null,
);

export const DbConsoleActionsProvider = DbConsoleActionsContext.Provider;

export function useDbConsoleActions(): DbConsoleActions | null {
	return use(DbConsoleActionsContext);
}
