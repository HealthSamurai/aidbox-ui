import {
	Tabs,
	TabsAddButton,
	TabsBrowserList,
	TabsListDropdown,
	TabsTrigger,
} from "@health-samurai/react-components";

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
}

export const DEFAULT_TAB_ID: TabId = "active-tab-example";

export const DEFAULT_TAB: Tab = {
	id: DEFAULT_TAB_ID,
	method: "GET",
	name: "New request",
	selected: true,
	activeSubTab: "body",
	headers: [
		{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
		{ id: "2", name: "Accept", value: "application/json", enabled: true },
		{ id: "3", name: "", value: "", enabled: true },
	],
	params: [{ id: "1", name: "", value: "", enabled: true }],
};

function addTab(
	tabs: Tab[],
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
) {
	const newTab: Tab = {
		...DEFAULT_TAB,
		id: crypto.randomUUID(),
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
}

function removeTab(
	tabs: Tab[],
	tabId: TabId,
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
) {
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
				idx === safeIndex
					? { ...tab, selected: true }
					: { ...tab, selected: false },
			);
		}
		setTabs(updatedTabs);
	}
}

function onTabSelect(
	tabId: TabId,
	tabs: Tab[],
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
) {
	setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

const methodColors = {
	GET: "text-utility-green",
	POST: "text-utility-yellow",
	PUT: "text-utility-blue",
	PATCH: "text-utility-violet",
	DELETE: "text-utility-red",
};

function TabContent({ tab }: { tab: Tab }) {
	return (
		<span className="flex items-center gap-1 truncate">
			<span className={methodColors[tab.method]}>{tab.method}</span>
			<span>{tab.path || tab.name}</span>
		</span>
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

	return (
		<Tabs variant="browser" value={selectedTab}>
			<TabsBrowserList>
				{tabs.map((tab) => {
					return (
						<TabsTrigger
							key={tab.id}
							value={tab.id}
							{...(tabs.length > 1 && {
								onClose: () => handleCloseTab(tab.id),
							})}
							onClick={() => handleTabSelect(tab.id)}
						>
							<TabContent tab={tab} />
						</TabsTrigger>
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
