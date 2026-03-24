import { createContext, use } from "react";
import type { SchemaMap } from "../components/db-console/utils";

export interface DbConsoleTab {
	id: string;
	query: string;
	selected: boolean;
}

export interface QueryResultItem {
	query: string;
	duration: number;
	result: Record<string, unknown>[];
	rows: number;
	status: string;
	error?: string;
}

export interface TableInfo {
	columns: { name: string; type: string; nullable: boolean }[];
	indexes: { name: string; type: string; definition: string }[];
	rowCount: number;
	tableSize: string;
	indexesSize: string;
}

export interface ActiveQueryInfo {
	pid: number;
	query: string;
	duration_seconds: number;
	usename: string;
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
	addTab: () => void;
	duplicateTab: (tabId: string) => void;
	closeTab: (tabId: string) => void;
	closeOtherTabs: (tabId: string) => void;
	closeTabsToLeft: (tabId: string) => void;
	closeTabsToRight: (tabId: string) => void;
	selectTable: (schema: string, name: string) => void;
	openSidebar: () => void;
	openSidebarTab: (tab: "history" | "tables" | "queries") => void;
	expandResults: () => void;
	collapseResults: () => void;
	maximizeResults: () => void;
	minimizeResults: () => void;
	showExplain: (mode?: "visual" | "raw") => void;
	showResults: () => void;
	getQueryStatus: () => {
		status: "loading" | "ready" | "error" | "empty";
		error?: string;
	};
	getResults: (limit?: number) => QueryResultItem[];
	getTableInfo: (schema: string, name: string) => Promise<TableInfo>;
	dropIndex: (indexName: string) => Promise<void>;
	getActiveQueries: () => Promise<ActiveQueryInfo[]>;
	cancelQuery: (pid: number) => Promise<void>;
	getRowLimit: () => number | null;
	setRowLimit: (limit: number | null) => void;
	getHistory: (search?: string, limit?: number) => HistoryEntry[];
	openHistoryEntry: (query: string) => void;
	getSchemas: () => SchemaMap;
}

export const DbConsoleActionsContext = createContext<DbConsoleActions | null>(
	null,
);

export const DbConsoleActionsProvider = DbConsoleActionsContext.Provider;

export function useDbConsoleActions(): DbConsoleActions | null {
	return use(DbConsoleActionsContext);
}
