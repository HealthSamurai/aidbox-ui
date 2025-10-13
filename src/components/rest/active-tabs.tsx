import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	Tabs,
	TabsAddButton,
	TabsBrowserList,
	TabsListDropdown,
	TabsTrigger,
} from "@health-samurai/react-components";

// Styles
export const methodColors = {
	GET: "text-utility-green typo-label-xs",
	POST: "text-utility-yellow typo-label-xs",
	PUT: "text-utility-blue typo-label-xs",
	PATCH: "text-utility-violet typo-label-xs",
	DELETE: "text-utility-red typo-label-xs",
};

const tabPathStyle = "typo-body-xs";

export type TabId = string;

export type Header = {
	id: string;
	name: string;
	value: string;
	enabled?: boolean;
};

export interface Tab {
	id: TabId;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path?: string;
	body?: string;
	selected?: boolean;
	headers?: Header[];
	params?: Header[];
	name?: string;
	activeSubTab?: "params" | "headers" | "body" | "raw";
	historyId?: string;
}

export const DEFAULT_TAB_ID: TabId = "active-tab-example";

export const DEFAULT_TAB: Tab = {
	id: DEFAULT_TAB_ID,
	method: "GET",
	name: "New request",
	selected: true,
	activeSubTab: "params",
	headers: [
		{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
		{ id: "2", name: "Accept", value: "application/json", enabled: true },
		{ id: "3", name: "", value: "", enabled: true },
	],
	params: [{ id: "1", name: "", value: "", enabled: true }],
};

export function addTab(tabs: Tab[], setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	const newTab: Tab = {
		...DEFAULT_TAB,
		id: crypto.randomUUID(),
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
	return newTab;
}

export function addTabFromHistory(
	tabs: Tab[],
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
	historyData: {
		method: string;
		path: string;
		headers: Header[];
		params?: Header[];
		body?: string;
		historyId: string;
	},
) {
	// Check if tab with this historyId already exists
	const existingTab = tabs.find((tab) => tab.historyId === historyData.historyId);

	if (existingTab) {
		// Focus existing tab instead of creating new one
		setTabs(tabs.map((t) => ({ ...t, selected: t.id === existingTab.id })));
		return;
	}

	const newTab: Tab = {
		...DEFAULT_TAB,
		id: crypto.randomUUID(),
		method: historyData.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: historyData.path,
		name: `${historyData.method} ${historyData.path}`,
		body: historyData.body || "",
		historyId: historyData.historyId,
		headers: [
			...historyData.headers,
			// Add empty header if not exists
			...(historyData.headers.some((h) => h.name === "" && h.value === "")
				? []
				: [{ id: crypto.randomUUID(), name: "", value: "", enabled: true }]),
		],
		params: historyData.params || [{ id: crypto.randomUUID(), name: "", value: "", enabled: true }],
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
}

export function forceSelectedTab(tabs: Tab[], tabIndex: number): Tab[] {
	const hasSelected = tabs.some((tab) => tab.selected);
	if (!hasSelected && tabs.length > 0) {
		const safeIndex = Math.min(tabIndex, tabs.length - 1);
		return tabs.map((tab, idx) => (idx === safeIndex ? { ...tab, selected: true } : { ...tab, selected: false }));
	}
	return tabs;
}

export function removeTab(tabs: Tab[], tabId: TabId, setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	const newTabs = tabs.filter((tab) => tab.id !== tabId);
	if (newTabs.length === 0) {
		setTabs([DEFAULT_TAB]);
	} else {
		const hasSelected = newTabs.some((tab) => tab.selected);
		let updatedTabs = newTabs;
		if (!hasSelected && newTabs.length > 0) {
			// Find the index of the removed tab in the original array
			const removedTabIndex = tabs.findIndex((tab) => tab.id === tabId);
			// Select the previous tab, or the first tab if removing the first one
			const targetIndex = removedTabIndex > 0 ? removedTabIndex - 1 : 0;
			// Make sure we don't go out of bounds in the new array
			const safeIndex = Math.min(targetIndex, newTabs.length - 1);

			updatedTabs = newTabs.map((tab, idx) =>
				idx === safeIndex ? { ...tab, selected: true } : { ...tab, selected: false },
			);
		}
		setTabs(updatedTabs);
	}
}

function onTabSelect(tabId: TabId, tabs: Tab[], setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

function TabContent({ tab }: { tab: Tab }) {
	return (
		<span className="flex items-center gap-1 truncate">
			<span className={methodColors[tab.method]}>{tab.method}</span>
			<span className={tabPathStyle}>{tab.path || tab.name}</span>
		</span>
	);
}

function TabContextMenuContent({
	tab,
	tabs,
	setTabs,
	handleCloseTab,
}: {
	tab: Tab;
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	handleCloseTab: (tabId: TabId) => void;
}) {
	const tabIndex = tabs.findIndex((t) => t.id === tab.id);

	const handleDuplicateTab = () => {
		const newTab = { ...tab, id: crypto.randomUUID(), selected: true };
		setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
	};

	const handleCloseTabsToLeft = () => {
		const newTabs = tabs.filter((_, index) => index >= tabIndex);
		setTabs(forceSelectedTab(newTabs, tabIndex));
	};

	const handleCloseTabsToRight = () => {
		const newTabs = tabs.filter((_, index) => index <= tabIndex);
		setTabs(forceSelectedTab(newTabs, tabIndex));
	};

	const handleCloseOtherTabs = () => {
		setTabs([{ ...tab, selected: true }]);
	};

	return (
		<ContextMenuContent className="w-50">
			<ContextMenuItem onClick={handleDuplicateTab}>Duplicate tab</ContextMenuItem>
			<ContextMenuSeparator></ContextMenuSeparator>
			<ContextMenuItem onClick={() => handleCloseTab(tab.id)}>Close tab</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseOtherTabs}>Close other tabs</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseTabsToLeft}>Close tabs to left</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseTabsToRight}>Close tabs to right</ContextMenuItem>
		</ContextMenuContent>
	);
}

export function ActiveTabs({
	tabs,
	setTabs,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
}) {
	const selectedTab = tabs.find((tab) => tab.selected)?.id || DEFAULT_TAB_ID;
	const handleCloseTab = (tabId: TabId) => {
		removeTab(tabs, tabId, setTabs);
	};
	const handleTabSelect = (tabId: TabId) => {
		onTabSelect(tabId, tabs, setTabs);
	};

	const handleTabMouseDown = (event: React.MouseEvent, tabId: TabId) => {
		// Middle mouse button (wheel click) - button 1
		if (event.button === 1) {
			event.preventDefault();
			event.stopPropagation();
			handleCloseTab(tabId);
		}
	};

	return (
		<Tabs variant="browser" value={selectedTab}>
			<TabsBrowserList>
				{tabs.map((tab) => {
					return (
						<ContextMenu key={tab.id}>
							<ContextMenuTrigger>
								<TabsTrigger
									value={tab.id}
									{...(tabs.length > 1 && {
										onClose: () => handleCloseTab(tab.id),
									})}
									onClick={() => handleTabSelect(tab.id)}
									onMouseDown={(event) => handleTabMouseDown(event, tab.id)}
								>
									<TabContent tab={tab} />
								</TabsTrigger>
							</ContextMenuTrigger>
							<TabContextMenuContent tab={tab} tabs={tabs} setTabs={setTabs} handleCloseTab={handleCloseTab} />
						</ContextMenu>
					);
				})}
			</TabsBrowserList>
			<TabsAddButton onClick={() => addTab(tabs, setTabs)} />
			<TabsListDropdown
				tabs={tabs.map((tab) => ({
					id: tab.id,
					content: <TabContent tab={tab} />,
				}))}
				handleTabSelect={handleTabSelect}
				handleCloseTab={handleCloseTab}
			/>
		</Tabs>
	);
}
