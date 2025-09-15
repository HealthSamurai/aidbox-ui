import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import React from "react";
import { useRefreshUIHistory, useUIHistory } from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import type { UIHistoryResource } from "../../shared/types";
import { addTabFromHistory, removeTab, type Tab } from "./active-tabs";
import { CollectionsView } from "./collections";

// Utility function for combining classes
function cn(...inputs: (string | undefined | boolean | null)[]) {
	return inputs.filter(Boolean).join(" ");
}

// =============================================================================
// STYLES
// =============================================================================

// Layout styles
const leftMenuContainer = cn("w-0", "invisible", "transition-[width]");

const leftMenuContainerOpen = cn("min-w-80", "w-80", "visible", "border-r");

const tabsHeader = cn("border-b", "h-10", "bg-bg-secondary");

const tabsContent = cn("p-0", "h-full");

const collectionsTabsContent = cn("text-nowrap");

// Loading and error state
const loadingContainer = cn("p-4", "text-center");

const loadingText = cn("typo-body", "text-text-secondary");

const errorText = cn("typo-body", "text-utility-red");

// Command styles
const commandContainer = cn("h-full");

const commandList = cn("h-full", "max-h-full", "p-0");

// History item styles
const historyItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"my-1",
	"py-2",
	"cursor-pointer",
	"hover:bg-bg-secondary",
);

const historyItemSelected = cn("bg-bg-tertiary", "text-text-primary");

const methodLabel = cn("typo-label-xs", "w-12", "text-right", "shrink-0");

const pathLabel = cn("typo-body-xs", "text-text-secondary", "truncate");

const pathLabelSelected = cn("typo-body-xs", "text-text-primary", "truncate");

// Toggle button styles
const toggleButton = cn("h-full", "flex-shrink-0", "border-b", "border-r");

const iconSize = cn("size-4");

// Method color mapping
const methodColors = {
	GET: "text-utility-green",
	POST: "text-utility-yellow",
	PUT: "text-utility-blue",
	PATCH: "text-utility-violet",
	DELETE: "text-utility-red",
} as const;

type LeftMenuStatus = "open" | "close";

const LeftMenuContext = React.createContext<LeftMenuStatus>("open");
export { LeftMenuContext };

// Helper function to parse HTTP command
function parseHttpCommand(command: string) {
	const lines = command.split("\n");
	if (lines.length === 0)
		return { method: "", path: "", headers: [], body: "" };

	const firstLine = lines[0]?.trim() || "";
	const [method, ...pathParts] = firstLine.split(" ");
	const path = pathParts.join(" ") || "";

	// Find where headers end (first empty line or end of headers)
	let headerEndIndex = 1;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]?.trim();
		if (!line || !line.includes(":")) {
			headerEndIndex = i;
			break;
		}
		headerEndIndex = i + 1;
	}

	const headers = lines
		.slice(1, headerEndIndex)
		.filter((line) => line.trim() && line.includes(":"))
		.map((line) => {
			const [key, ...valueParts] = line.split(":");
			return { key: key?.trim() || "", value: valueParts.join(":").trim() };
		});

	// Extract body (everything after headers)
	const bodyLines = lines.slice(headerEndIndex).filter((line) => line.trim());
	const body = bodyLines.length > 0 ? bodyLines.join("\n") : "";

	return { method: method || "", path, headers, body };
}

// Helper function to get time group for an item
function getTimeGroup(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();

	// Reset time to start of day for comparison
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const itemDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);

	if (itemDate.getTime() === today.getTime()) {
		return "TODAY";
	}
	if (itemDate.getTime() === yesterday.getTime()) {
		return "YESTERDAY";
	}

	// Format date as DD.MM.YYYY
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}.${month}.${year}`;
}

// Helper function to group history items by time
function groupHistoryByTime(items: UIHistoryResource[]) {
	const groups: Record<string, UIHistoryResource[]> = {};

	items.forEach((item) => {
		const group = getTimeGroup(item.meta.createdAt);
		if (!groups[group]) {
			groups[group] = [];
		}
		groups[group].push(item);
	});

	// Sort items within each group by creation time (newest first)
	Object.keys(groups).forEach((key) => {
		const groupItems = groups[key];
		if (groupItems) {
			groupItems.sort(
				(a, b) =>
					new Date(b.meta.createdAt).getTime() -
					new Date(a.meta.createdAt).getTime(),
			);
		}
	});

	return groups;
}

// Helper function to check if history item matches selected tab
function isHistoryItemSelected(
	item: UIHistoryResource,
	selectedTab?: Tab,
): boolean {
	if (!selectedTab || !selectedTab.historyId) return false;
	return item.id === selectedTab.historyId;
}

// Helper function to format group title
function formatGroupTitle(groupKey: string, allGroupKeys: string[]): string {
	// If there's only one group and it's TODAY, don't show the title
	if (groupKey === "TODAY" && allGroupKeys.length === 1) {
		return "";
	}

	if (groupKey === "TODAY" || groupKey === "YESTERDAY") {
		return groupKey;
	}

	// For date strings in DD.MM.YYYY format, add day of week
	try {
		const [day, month, year] = groupKey.split(".");
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
		return `${dayOfWeek}, ${groupKey}`;
	} catch {
		return groupKey;
	}
}

// Component for Command-based history
function HistoryCommand({
	groupedHistory,
	getSortedGroupKeys,
	selectedTab,
	onItemClick,
	onItemMiddleClick,
}: {
	groupedHistory: Record<string, UIHistoryResource[]>;
	getSortedGroupKeys: (groups: Record<string, UIHistoryResource[]>) => string[];
	selectedTab?: Tab;
	onItemClick: (item: UIHistoryResource) => void;
	onItemMiddleClick: (item: UIHistoryResource) => void;
}) {
	const getMethodColor = (method: string) => {
		return (
			methodColors[method.toUpperCase() as keyof typeof methodColors] ||
			"text-text-secondary"
		);
	};

	const handleItemMouseDown = (
		event: React.MouseEvent,
		item: UIHistoryResource,
	) => {
		// Middle mouse button (wheel click) - button 1
		if (event.button === 1) {
			event.preventDefault();
			event.stopPropagation();
			onItemMiddleClick(item);
		}
	};

	const createSearchableText = (item: UIHistoryResource) => {
		const { method, path, headers, body } = parseHttpCommand(item.command);
		const headersText = headers.map((h) => `${h.key}:${h.value}`).join(" ");
		return `${method} ${path} ${headersText} ${body}`.toLowerCase();
	};

	return (
		<Command className={commandContainer}>
			<CommandInput placeholder="Search history..." />
			<CommandList className={commandList}>
				<CommandEmpty>No history found.</CommandEmpty>
				{getSortedGroupKeys(groupedHistory).map((groupKey) => {
					const items = groupedHistory[groupKey];
					if (!items || items.length === 0) return null;

					const allGroupKeys = getSortedGroupKeys(groupedHistory);
					const groupTitle = formatGroupTitle(groupKey, allGroupKeys);

					return (
						<CommandGroup key={groupKey} heading={groupTitle}>
							{items.map((item) => {
								const { method, path } = parseHttpCommand(item.command);
								const isSelected = isHistoryItemSelected(item, selectedTab);
								return (
									<CommandItem
										key={item.id}
										value={createSearchableText(item)}
										onSelect={() => onItemClick(item)}
										onMouseDown={(event) => handleItemMouseDown(event, item)}
										className={cn(
											historyItem,
											isSelected && historyItemSelected,
										)}
									>
										<span
											className={cn(methodLabel, getMethodColor(method || ""))}
										>
											{method}
										</span>
										<div
											className={isSelected ? pathLabelSelected : pathLabel}
											title={path}
										>
											{path}
										</div>
									</CommandItem>
								);
							})}
						</CommandGroup>
					);
				})}
			</CommandList>
		</Command>
	);
}

export function LeftMenu({
	tabs,
	setTabs,
	selectedTab,
	onHistoryRefreshNeeded,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	selectedTab?: Tab;
	onHistoryRefreshNeeded?: (refreshFn: () => void) => void;
}) {
	const leftMenuStatus = React.useContext(LeftMenuContext);
	const { data: historyData, isLoading, error } = useUIHistory();
	const refreshHistory = useRefreshUIHistory();

	// Call parent callback when refresh function is available
	React.useEffect(() => {
		if (onHistoryRefreshNeeded) {
			onHistoryRefreshNeeded(refreshHistory);
		}
	}, [onHistoryRefreshNeeded, refreshHistory]);

	const handleHistoryItemClick = (item: UIHistoryResource) => {
		const { method, path, headers, body } = parseHttpCommand(item.command);

		// Extract params from path
		const queryParams = path.split("?")[1];
		const params =
			queryParams?.split("&").map((param, index) => {
				const [name, value] = param.split("=");
				try {
					return {
						id: `${index}`,
						name: decodeURIComponent(name ?? ""),
						value: decodeURIComponent(value ?? ""),
						enabled: true,
					};
				} catch {
					// Fallback if decoding fails
					return {
						id: `${index}`,
						name: name ?? "",
						value: value ?? "",
						enabled: true,
					};
				}
			}) || [];

		// Add empty param if needed
		if (!params.some((p) => p.name === "" && p.value === "")) {
			params.push({
				id: crypto.randomUUID(),
				name: "",
				value: "",
				enabled: true,
			});
		}

		// Create new tab with history data
		addTabFromHistory(tabs, setTabs, {
			method,
			path,
			headers: headers.map((h) => ({
				id: crypto.randomUUID(),
				name: h.key,
				value: h.value,
				enabled: true,
			})),
			body: body,
			params,
			historyId: item.id,
		});
	};

	const handleHistoryItemMiddleClick = (item: UIHistoryResource) => {
		// Find tab with this historyId and close it
		const existingTab = tabs.find((tab) => tab.historyId === item.id);
		if (existingTab) {
			removeTab(tabs, existingTab.id, setTabs);
		}
	};

	// Group history items by time
	const groupedHistory = React.useMemo(() => {
		if (!historyData?.entry) return {};
		return groupHistoryByTime(historyData.entry.map((entry) => entry.resource));
	}, [historyData]);

	// Helper function to sort group keys in chronological order
	const getSortedGroupKeys = React.useCallback(
		(groups: Record<string, UIHistoryResource[]>) => {
			return Object.keys(groups).sort((a, b) => {
				// TODAY should be first
				if (a === "TODAY") return -1;
				if (b === "TODAY") return 1;

				// YESTERDAY should be second
				if (a === "YESTERDAY") return -1;
				if (b === "YESTERDAY") return 1;

				// For date strings, sort in descending order (newest first)
				const dateA = new Date(a.split(".").reverse().join("-")); // Convert DD.MM.YYYY to YYYY-MM-DD
				const dateB = new Date(b.split(".").reverse().join("-"));
				return dateB.getTime() - dateA.getTime();
			});
		},
		[],
	);

	const [selectedMenuTab, setSelectedMenuTab] = useLocalStorage<string>({
		key: "rest-console-left-menu-default-tab",
		defaultValue: "history",
	});

	return (
		<div
			className={cn(
				leftMenuContainer,
				leftMenuStatus === "open" && leftMenuContainerOpen,
			)}
		>
			<Tabs value={selectedMenuTab} onValueChange={setSelectedMenuTab}>
				<div className={tabsHeader}>
					<TabsList>
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="collections">Collections</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="history" className={tabsContent}>
					{isLoading && (
						<div className={loadingContainer}>
							<div className={loadingText}>Loading history...</div>
						</div>
					)}
					{error && (
						<div className={loadingContainer}>
							<div className={errorText}>Failed to load history</div>
						</div>
					)}
					{historyData?.entry?.length === 0 && (
						<div className={loadingContainer}>
							<div className={loadingText}>No history found</div>
						</div>
					)}
					{historyData?.entry && historyData.entry.length > 0 && (
						<HistoryCommand
							groupedHistory={groupedHistory}
							getSortedGroupKeys={getSortedGroupKeys}
							selectedTab={selectedTab as Tab}
							onItemClick={handleHistoryItemClick}
							onItemMiddleClick={handleHistoryItemMiddleClick}
						/>
					)}
				</TabsContent>
				<TabsContent value="collections" className={collectionsTabsContent}>
					<CollectionsView tabs={tabs} setTabs={setTabs} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

type LeftMenuToggleProps = {
	onOpen: () => void;
	onClose: () => void;
};

export function LeftMenuToggle({ onOpen, onClose }: LeftMenuToggleProps) {
	const leftMenuStatus = React.useContext<LeftMenuStatus>(LeftMenuContext);

	return (
		<Tooltip delayDuration={600}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className={toggleButton}
					onClick={leftMenuStatus === "open" ? onClose : onOpen}
				>
					{leftMenuStatus === "open" ? (
						<PanelLeftClose className={iconSize} />
					) : (
						<PanelLeftOpen className={iconSize} />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>History / Collections</TooltipContent>
		</Tooltip>
	);
}
