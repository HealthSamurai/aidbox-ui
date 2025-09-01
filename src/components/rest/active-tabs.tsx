import {
	Tabs,
	TabsAddButton,
	TabsList,
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

function addTab(tabs: Tab[], setTabs: (val: Tab[]) => void) {
	const newTab: Tab = {
		...DEFAULT_TAB,
		id: crypto.randomUUID(),
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
}

function removeTab(tabs: Tab[], tabId: TabId, setTabs: (val: Tab[]) => void) {
	const newTabs = tabs.filter((tab) => tab.id !== tabId);
	if (newTabs.length === 0) {
		setTabs([DEFAULT_TAB]);
	} else {
		const hasSelected = newTabs.some((tab) => tab.selected);
		let updatedTabs = newTabs;
		if (!hasSelected && newTabs.length > 0) {
			updatedTabs = newTabs.map((tab, idx) =>
				idx === 0 ? { ...tab, selected: true } : { ...tab, selected: false },
			);
		}
		setTabs(updatedTabs);
	}
}

function onTabSelect(tabId: TabId, tabs: Tab[], setTabs: (val: Tab[]) => void) {
	setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

const methodColors = {
	GET: "text-utility-green",
	POST: "text-utility-yellow",
	PUT: "text-utility-blue",
	PATCH: "text-utility-violet",
	DELETE: "text-utility-red",
};

export function ActiveTabs({
	tabs,
	setTabs,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[]) => void;
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
			<TabsList>
				{tabs.map((tab) => (
					<TabsTrigger
						key={tab.id}
						value={tab.id}
						onClose={() => handleCloseTab(tab.id)}
						onClick={() => handleTabSelect(tab.id)}
					>
						<span className="flex items-center gap-1 truncate">
							<span className={methodColors[tab.method]}>{tab.method}</span>
							<span>{tab.path || tab.name}</span>
						</span>
					</TabsTrigger>
				))}
			</TabsList>
			<TabsAddButton onClick={() => addTab(tabs, setTabs)} />
		</Tabs>
	);
}
