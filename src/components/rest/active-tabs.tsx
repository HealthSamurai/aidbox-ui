import {
  Button,
  METHOD_COLORS,
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

interface Tab {
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

function handleTabSelect(tabId: TabId, tabs: Tab[], setTabs: (val: Tab[]) => void) {
  setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}

export function ActiveTabs({ tabs, setTabs }: { tabs: Tab[], setTabs: (val: Tab[]) => void }) {
  const selectedTab = tabs.find((tab) => tab.selected)?.id || DEFAULT_TAB_ID;
  return (
    <React.Fragment>
      <Tabs value={selectedTab} className="overflow-x-auto overflow-y-hidden">
        <TabsList className="w-full">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              <TabsTrigger
                value={tab.id}
                className="max-w-80 w-50 min-w-30"
                onClick={() => handleTabSelect(tab.id, tabs, setTabs)}
              >
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <span className="w-full flex items-center justify-between">
                      <span className="truncate">
                        <span
                          className={`mr-1 ${METHOD_COLORS[tab.method as keyof typeof METHOD_COLORS].text}`}
                        >
                          {tab.method}
                        </span>
                        {tab.name || tab.path}
                      </span>
                      <Button
                        variant="link"
                        className="p-0 ml-2"
                        asChild
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTab(tabs, tab.id, setTabs)
                        }}
                      >
                        <span>
                          <X size={16} />
                        </span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    {tab.method} {tab.path}
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>
              {index < tabs.length - 1 && <Separator orientation="vertical" />}
            </React.Fragment>
          ))}
        </TabsList>
      </Tabs>
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
