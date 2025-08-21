import {
  Button,
  RestConsoleTabs,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@health-samurai/react-components";
import { Plus, X } from "lucide-react";
import * as React from "react";

export type TabId = string;

export interface Tab {
  id: TabId;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  body?: string;
  selected?: boolean;
  headers?: string;
  name?: string;
}

export const DEFAULT_TAB_ID: TabId = "active-tab-example";

export const DEFAULT_TABS: Tab[] = [
  {
    id: DEFAULT_TAB_ID,
    method: "GET",
    path: "/fhir/Patient",
  },
];

function addTab(tabs: Tab[], setTabs: (val: Tab[]) => void) {
  const newTab: Tab = {
    id: crypto.randomUUID(),
    method: "GET",
    name: "New request",
    selected: true,
  };
  setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
}

function removeTab(tabs: Tab[], tabId: TabId, setTabs: (val: Tab[]) => void) {
  const newTabs = tabs.filter((tab) => tab.id !== tabId);
  if (newTabs.length === 0) {
    setTabs(DEFAULT_TABS);
  } else {
    return setTabs(newTabs);
  }
}

function onTabSelect(
  tabId: TabId,
  tabs: Tab[],
  setTabs: (val: Tab[]) => void,
) {
  setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

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
    <React.Fragment>
      <RestConsoleTabs
        tabs={tabs}
        selectedTabId={selectedTab}
        onSelectTab={handleTabSelect}
        onCloseTab={handleCloseTab}
      />
      <div className="bg-bg-secondary border-l">
        <Button
          variant="link"
          className="h-full"
          onClick={() => addTab(tabs, setTabs)}
        >
          <Plus />
        </Button>
      </div>
    </React.Fragment>
  );
}
