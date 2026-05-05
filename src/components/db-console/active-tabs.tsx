import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
	Tabs,
	TabsAddButton,
	TabsBrowserList,
	TabsListDropdown,
	TabsTrigger,
} from "@health-samurai/react-components";
import { generateId } from "../../utils";
import { DEFAULT_TIMEOUT_SEC } from "./utils";

export type SqlTabId = string;

export interface SqlTabSettings {
	rowLimit: number | null;
	timeoutSec: number | null;
	autocommit: boolean;
	readOnly: boolean;
	asyncMode: boolean;
}

export interface SqlTab {
	id: SqlTabId;
	query: string;
	selected?: boolean;
	// Per-tab execution settings. Optional for backward compat with tabs
	// persisted before settings moved onto the tab; read via tabSettings()
	// which fills in DEFAULT_SQL_TAB_SETTINGS for missing keys.
	settings?: Partial<SqlTabSettings>;
}

const DEFAULT_QUERY = "select * from patient";

export const DEFAULT_SQL_TAB_ID: SqlTabId = "sql-tab-default";

export const DEFAULT_SQL_TAB_SETTINGS: SqlTabSettings = {
	rowLimit: 10,
	timeoutSec: DEFAULT_TIMEOUT_SEC,
	autocommit: true,
	readOnly: false,
	asyncMode: false,
};

export function tabSettings(tab: SqlTab | undefined): SqlTabSettings {
	return { ...DEFAULT_SQL_TAB_SETTINGS, ...(tab?.settings ?? {}) };
}

export const DEFAULT_SQL_TAB: SqlTab = {
	id: DEFAULT_SQL_TAB_ID,
	query: DEFAULT_QUERY,
	selected: true,
	settings: DEFAULT_SQL_TAB_SETTINGS,
};

export function addSqlTab(
	tabs: SqlTab[],
	setTabs: (val: SqlTab[] | ((prev: SqlTab[]) => SqlTab[])) => void,
) {
	const newTab: SqlTab = {
		id: generateId(),
		query: DEFAULT_QUERY,
		selected: true,
		settings: DEFAULT_SQL_TAB_SETTINGS,
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
	return newTab;
}

export function forceSelectedTab(tabs: SqlTab[], tabIndex: number): SqlTab[] {
	const hasSelected = tabs.some((tab) => tab.selected);
	if (!hasSelected && tabs.length > 0) {
		const safeIndex = Math.min(tabIndex, tabs.length - 1);
		return tabs.map((tab, idx) =>
			idx === safeIndex
				? { ...tab, selected: true }
				: { ...tab, selected: false },
		);
	}
	return tabs;
}

function removeSqlTab(
	tabs: SqlTab[],
	tabId: SqlTabId,
	setTabs: (val: SqlTab[] | ((prev: SqlTab[]) => SqlTab[])) => void,
) {
	const newTabs = tabs.filter((tab) => tab.id !== tabId);
	if (newTabs.length === 0) {
		setTabs([{ ...DEFAULT_SQL_TAB, id: generateId() }]);
	} else {
		const hasSelected = newTabs.some((tab) => tab.selected);
		let updatedTabs = newTabs;
		if (!hasSelected) {
			const removedTabIndex = tabs.findIndex((tab) => tab.id === tabId);
			const targetIndex = removedTabIndex > 0 ? removedTabIndex - 1 : 0;
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
	tabId: SqlTabId,
	tabs: SqlTab[],
	setTabs: (val: SqlTab[] | ((prev: SqlTab[]) => SqlTab[])) => void,
) {
	setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

function truncateQuery(query: string, maxLen = 30): string {
	const trimmed = query.trim().replace(/\s+/g, " ");
	if (!trimmed) return "New query";
	if (trimmed.length <= maxLen) return trimmed;
	return `${trimmed.slice(0, maxLen)}…`;
}

function TabContent({ tab }: { tab: SqlTab }) {
	return (
		<span className="truncate typo-body-xs leading-4!">
			{truncateQuery(tab.query)}
		</span>
	);
}

function TabContextMenuContent({
	tab,
	tabs,
	setTabs,
	handleCloseTab,
	onTabsRemoved,
}: {
	tab: SqlTab;
	tabs: SqlTab[];
	setTabs: (val: SqlTab[] | ((prev: SqlTab[]) => SqlTab[])) => void;
	handleCloseTab: (tabId: SqlTabId) => void;
	onTabsRemoved?: (tabIds: SqlTabId[]) => void;
}) {
	const tabIndex = tabs.findIndex((t) => t.id === tab.id);

	const handleDuplicateTab = () => {
		const newTab = { ...tab, id: generateId(), selected: true };
		setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
	};

	const handleCloseTabsToLeft = () => {
		const removedTabIds = tabs
			.filter((_, index) => index < tabIndex)
			.map((t) => t.id);
		const newTabs = tabs.filter((_, index) => index >= tabIndex);
		setTabs(forceSelectedTab(newTabs, 0));
		onTabsRemoved?.(removedTabIds);
	};

	const handleCloseTabsToRight = () => {
		const removedTabIds = tabs
			.filter((_, index) => index > tabIndex)
			.map((t) => t.id);
		const newTabs = tabs.filter((_, index) => index <= tabIndex);
		setTabs(forceSelectedTab(newTabs, tabIndex));
		onTabsRemoved?.(removedTabIds);
	};

	const handleCloseOtherTabs = () => {
		const removedTabIds = tabs.filter((t) => t.id !== tab.id).map((t) => t.id);
		setTabs([{ ...tab, selected: true }]);
		onTabsRemoved?.(removedTabIds);
	};

	return (
		<ContextMenuContent className="w-50">
			<ContextMenuItem onClick={handleDuplicateTab}>
				Duplicate tab
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onClick={() => handleCloseTab(tab.id)}>
				Close tab
			</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseOtherTabs}>
				Close other tabs
			</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseTabsToLeft}>
				Close tabs to left
			</ContextMenuItem>
			<ContextMenuItem onClick={handleCloseTabsToRight}>
				Close tabs to right
			</ContextMenuItem>
		</ContextMenuContent>
	);
}

export function SqlActiveTabs({
	tabs,
	setTabs,
	onTabsRemoved,
}: {
	tabs: SqlTab[];
	setTabs: (val: SqlTab[] | ((prev: SqlTab[]) => SqlTab[])) => void;
	onTabsRemoved?: (tabIds: SqlTabId[]) => void;
}) {
	const selectedTab =
		tabs.find((tab) => tab.selected)?.id || DEFAULT_SQL_TAB_ID;

	const handleCloseTab = (tabId: SqlTabId) => {
		removeSqlTab(tabs, tabId, setTabs);
		onTabsRemoved?.([tabId]);
	};

	const handleTabSelect = (tabId: SqlTabId) => {
		onTabSelect(tabId, tabs, setTabs);
	};

	const handleTabMouseDown = (event: React.MouseEvent, tabId: SqlTabId) => {
		if (event.button === 1) {
			event.preventDefault();
			event.stopPropagation();
			handleCloseTab(tabId);
		}
	};

	return (
		<Tabs variant="browser" value={selectedTab}>
			<TabsBrowserList
				onReorder={(from, to) => {
					setTabs((prev) => {
						const result = [...prev];
						const [moved] = result.splice(from, 1);
						if (moved) result.splice(to, 0, moved);
						return result;
					});
				}}
			>
				{tabs.map((tab) => (
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
						<TabContextMenuContent
							tab={tab}
							tabs={tabs}
							setTabs={setTabs}
							handleCloseTab={handleCloseTab}
							onTabsRemoved={onTabsRemoved}
						/>
					</ContextMenu>
				))}
			</TabsBrowserList>
			<TabsAddButton onClick={() => addSqlTab(tabs, setTabs)} />
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
