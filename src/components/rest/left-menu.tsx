import {
	Button,
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
import type { UIHistoryResource } from "../../shared/types";
import { addTabFromHistory, removeTab, type Tab } from "./active-tabs";

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

// Helper function to format group title
function formatGroupTitle(groupKey: string): string {
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

// Component for group header
function GroupHeader({ title }: { title: string }) {
	const displayTitle = formatGroupTitle(title);
	return (
		<h3 className="text-text-quternary text-sm font-semibold uppercase tracking-wide border-b py-2">
			{displayTitle}
		</h3>
	);
}

// Component for individual history item
function HistoryItem({
	item,
	onClick,
	onMiddleClick,
}: {
	item: UIHistoryResource;
	onClick?: (item: UIHistoryResource) => void;
	onMiddleClick?: (item: UIHistoryResource) => void;
}) {
	const { method, path } = parseHttpCommand(item.command);

	const getMethodColor = (method: string) => {
		const methodColors: Record<string, string> = {
			GET: "text-utility-green",
			POST: "text-utility-yellow",
			PUT: "text-utility-blue",
			PATCH: "text-utility-violet",
			DELETE: "text-utility-red",
		};
		return methodColors[method.toUpperCase()] || "text-text-secondary";
	};

	const handleMouseDown = (event: React.MouseEvent) => {
		// Middle mouse button (wheel click) - button 1
		if (event.button === 1) {
			event.preventDefault();
			event.stopPropagation();
			onMiddleClick?.(item);
		}
	};

	return (
		<button
			type="button"
			className={`flex flex-col gap-1 py-2 hover:opacity-70 cursor-pointer rounded w-full`}
			onClick={() => onClick?.(item)}
			onMouseDown={handleMouseDown}
		>
			<div className="flex items-center gap-2 typo-code">
				<span className={`text-sm font-medium ${getMethodColor(method || "")}`}>
					{method}
				</span>
				<div className="text-sm truncate" title={path}>
					{path}
				</div>
			</div>
		</button>
	);
}

export function LeftMenu({
	tabs,
	setTabs,
	onHistoryRefreshNeeded,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
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

	return (
		<div
			className={`w-0 invisible transition-[width] ${leftMenuStatus === "open" ? "min-w-70 w-70 visible border-r" : ""}`}
		>
			<Tabs defaultValue="history">
				<div className="border-b h-10 bg-bg-secondary">
					<TabsList>
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="collections">Collections</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="history" className="p-0 text-nowrap">
					<div className="h-full overflow-y-auto">
						{isLoading && (
							<div className="p-4 text-center text-sm text-gray-500">
								Loading history...
							</div>
						)}
						{error && (
							<div className="p-4 text-center text-sm text-red-500">
								Failed to load history
							</div>
						)}
						{historyData?.entry?.length === 0 && (
							<div className="p-4 text-center text-sm text-gray-500">
								No history found
							</div>
						)}
						{historyData?.entry &&
							historyData.entry.length > 0 &&
							getSortedGroupKeys(groupedHistory).map((groupKey) => {
								const items = groupedHistory[groupKey];
								if (!items || items.length === 0) return null;

								return (
									<div key={groupKey} className="px-3 py-2">
										<GroupHeader title={groupKey} />
										{items.map((item) => (
											<HistoryItem
												key={item.id}
												item={item}
												onClick={handleHistoryItemClick}
												onMiddleClick={handleHistoryItemMiddleClick}
											/>
										))}
									</div>
								);
							})}
					</div>
				</TabsContent>
				<TabsContent value="collections" className="px-3 py-2 text-nowrap">
					todo collections
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
					className="h-full border-b flex-shrink-0 border-r"
					onClick={leftMenuStatus === "open" ? onClose : onOpen}
				>
					{leftMenuStatus === "open" ? (
						<PanelLeftClose className="size-4" />
					) : (
						<PanelLeftOpen className="size-4" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>History / Collections</TooltipContent>
		</Tooltip>
	);
}
