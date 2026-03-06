export interface RestConsoleActions {
	getLeftMenuOpen: () => boolean;
	setLeftMenuOpen: (open: boolean) => void;
	getMenuTab: () => string;
	setMenuTab: (tab: string) => void;
	searchHistory: (
		query?: string,
	) => Promise<{ id: string; method: string; path: string; date: string }[]>;
	selectHistoryItem: (id: string) => void;
	listCollections: () => Promise<
		{
			name: string;
			items: { id: string; method: string; path: string; title?: string }[];
		}[]
	>;
	saveToCollection: (collectionName?: string) => Promise<void>;
	addCollectionEntry: (collectionName: string) => Promise<void>;
	renameCollection: (name: string, newName: string) => Promise<void>;
	deleteCollection: (name: string) => Promise<void>;
	renameSnippet: (id: string, newTitle: string) => Promise<void>;
	deleteSnippet: (id: string) => Promise<void>;
	listTabs: () => {
		id: string;
		method: string;
		path: string;
		selected: boolean;
	}[];
	selectTab: (id: string) => void;
	addTab: () => string;
	closeTab: (id?: string) => void;
	closeOtherTabs: (id?: string) => void;
	closeTabsToLeft: (id?: string) => void;
	closeTabsToRight: (id?: string) => void;
	getRawRequest: () => string;
	setRawRequest: (raw: string) => void;
	getBodyMode: () => "json" | "yaml";
	setBodyMode: (mode: "json" | "yaml") => void;
	formatBody: () => void;
	getRequestBody: () => string;
	setRequestBody: (body: string) => void;
	getRequestHeaders: () => { name: string; value: string; enabled: boolean }[];
	setRequestHeaders: (
		headers: { name: string; value: string; enabled?: boolean }[],
	) => void;
	toggleRequestHeader: (name: string, enabled?: boolean) => void;
	getRequestParams: () => { name: string; value: string; enabled: boolean }[];
	setRequestParams: (
		params: { name: string; value: string; enabled?: boolean }[],
	) => void;
	toggleRequestParam: (name: string, enabled?: boolean) => void;
	sendRequest: () => Promise<{
		status: number;
		statusText: string;
		headers: Record<string, string>;
		body: string;
		duration: number;
	}>;
	getResponse: () => {
		status: number;
		statusText: string;
		headers: Record<string, string>;
		body: string;
		duration: number;
	} | null;
	getResponseTab: () => string;
	setResponseTab: (tab: string) => void;
	getPanelLayout: () => string;
	setPanelLayout: (layout: string) => void;
	setRequestSubTab: (subTab: "params" | "headers" | "body" | "raw") => void;
}
