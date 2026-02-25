import type {
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
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
import React, { useCallback, useMemo, useRef } from "react";
import { useSqlHistory } from "../../api/sql-history";
import { useLocalStorage } from "../../hooks";
import { ActiveQueriesView } from "./active-queries-view";
import { SqlTablesCommand } from "./tables-view";

// Types

type SqlHistoryEntry = Resource & {
	command: string;
	type: string;
};

function isSqlHistoryEntry(
	resource: Resource | undefined,
): resource is SqlHistoryEntry {
	if (resource === undefined) return false;
	return resource.resourceType === "ui_history";
}

// Styles

function cn(...inputs: (string | undefined | boolean | null)[]) {
	return inputs.filter(Boolean).join(" ");
}

const leftMenuContainer = cn(
	"w-0",
	"shrink-0",
	"overflow-hidden",
	"transition-[width]",
	"duration-200",
);
const leftMenuContainerOpen = cn("w-80", "border-r");

const tabsHeader = cn("border-b", "h-10", "bg-bg-secondary");
const tabsContent = cn("p-0", "h-full");

const commandContainer = cn(
	"h-full",
	"flex",
	"flex-col",
	"overflow-hidden",
	"[&_[cmdk-input-wrapper]]:flex-none",
);
const commandList = cn("flex-1", "min-h-0", "max-h-none!", "p-0");

const historyItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"my-1",
	"py-2",
	"cursor-pointer",
	"hover:bg-bg-secondary",
	"data-[selected=true]:bg-bg-secondary",
);

const toggleButton = cn("h-full", "flex-shrink-0", "border-b", "border-r");
const iconSize = cn("size-4");

// Date grouping helpers

function getTimeGroup(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const itemDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);

	if (itemDate.getTime() === today.getTime()) return "TODAY";
	if (itemDate.getTime() === yesterday.getTime()) return "YESTERDAY";

	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}.${month}.${year}`;
}

function groupHistoryByTime(
	items: SqlHistoryEntry[],
): Record<string, (SqlHistoryEntry & { lastUpdated: number })[]> {
	const groups: Record<string, (SqlHistoryEntry & { lastUpdated: number })[]> =
		{};

	for (const item of items) {
		const lu = item.meta?.lastUpdated;
		if (!lu) continue;

		const group = getTimeGroup(lu);
		if (!groups[group]) groups[group] = [];
		groups[group].push({ ...item, lastUpdated: new Date(lu).getTime() });
	}

	for (const key of Object.keys(groups)) {
		groups[key]?.sort((a, b) => b.lastUpdated - a.lastUpdated);
	}

	return groups;
}

function formatGroupTitle(groupKey: string, allGroupKeys: string[]): string {
	if (groupKey === "TODAY" && allGroupKeys.length === 1) return "";
	if (groupKey === "TODAY" || groupKey === "YESTERDAY") return groupKey;

	try {
		const [day, month, year] = groupKey.split(".");
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
		return `${dayOfWeek}, ${groupKey}`;
	} catch {
		return groupKey;
	}
}

function getSortedGroupKeys(groups: Record<string, unknown[]>): string[] {
	return Object.keys(groups).sort((a, b) => {
		if (a === "TODAY") return -1;
		if (b === "TODAY") return 1;
		if (a === "YESTERDAY") return -1;
		if (b === "YESTERDAY") return 1;

		const dateA = new Date(a.split(".").reverse().join("-"));
		const dateB = new Date(b.split(".").reverse().join("-"));
		return dateB.getTime() - dateA.getTime();
	});
}

// Context

type LeftMenuStatus = "open" | "close";

const SqlLeftMenuContext = React.createContext<LeftMenuStatus>("open");
export { SqlLeftMenuContext };

// History list component

function SqlHistoryCommand({
	groupedHistory,
	onItemClick,
}: {
	groupedHistory: Record<string, SqlHistoryEntry[]>;
	onItemClick: (command: string) => void;
}) {
	const listRef = useRef<HTMLDivElement>(null);

	const resetScroll = useCallback(() => {
		requestAnimationFrame(() => {
			if (listRef.current) listRef.current.scrollTop = 0;
		});
	}, []);

	return (
		<Command className={commandContainer}>
			<CommandInput
				placeholder="Search history..."
				onValueChange={resetScroll}
			/>
			<CommandList ref={listRef} className={commandList}>
				<CommandEmpty>No history found.</CommandEmpty>
				{getSortedGroupKeys(groupedHistory).map((groupKey) => {
					const items = groupedHistory[groupKey];
					if (!items || items.length === 0) return null;

					const allGroupKeys = getSortedGroupKeys(groupedHistory);
					const groupTitle = formatGroupTitle(groupKey, allGroupKeys);

					return (
						<CommandGroup key={groupKey} heading={groupTitle}>
							{items.map((item) => {
								const normalized = item.command.trim().replace(/\s+/g, " ");

								return (
									<CommandItem
										key={item.id}
										value={`${item.id}-${normalized.toLowerCase()}`}
										onSelect={() => onItemClick(item.command)}
										className={historyItem}
									>
										<span className="typo-body-xs leading-4! text-text-secondary truncate">
											{normalized}
										</span>
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

// Main left menu

export function SqlLeftMenu({
	schemas,
	onHistoryItemClick,
	onTableClick,
}: {
	schemas: Record<string, string[]>;
	onHistoryItemClick: (command: string) => void;
	onTableClick: (query: string) => void;
}) {
	const leftMenuStatus = React.useContext(SqlLeftMenuContext);
	const { data: historyData, isLoading, error } = useSqlHistory();

	const [selectedMenuTab, setSelectedMenuTab] = useLocalStorage<string>({
		key: "db-console-left-menu-default-tab",
		defaultValue: "history",
		getInitialValueInEffect: false,
	});

	const groupedHistory = useMemo(() => {
		if (!historyData?.entry) return {};
		return groupHistoryByTime(
			historyData.entry.flatMap((entry: BundleEntry) => {
				if (isSqlHistoryEntry(entry.resource)) return entry.resource;
				throw new Error("incorrect resource in sql history response", {
					cause: entry.resource,
				});
			}),
		);
	}, [historyData]);

	return (
		<div
			className={cn(
				leftMenuContainer,
				leftMenuStatus === "open" && leftMenuContainerOpen,
			)}
		>
			<Tabs
				value={selectedMenuTab}
				onValueChange={setSelectedMenuTab}
				className="min-w-80"
			>
				<div className={tabsHeader}>
					<TabsList>
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="tables">Tables</TabsTrigger>
						<TabsTrigger value="queries">Queries</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="history" className={tabsContent}>
					{isLoading && (
						<div className="p-4 text-center">
							<div className="typo-body text-text-secondary">
								Loading history...
							</div>
						</div>
					)}
					{error && (
						<div className="p-4 text-center">
							<div className="typo-body text-utility-red">
								Failed to load history
							</div>
						</div>
					)}
					{historyData && !historyData.entry?.length && (
						<div className="bg-bg-tertiary h-full flex items-center justify-center">
							<span className="text-text-disabled text-xl font-medium">
								No history
							</span>
						</div>
					)}
					{historyData?.entry && historyData.entry.length > 0 && (
						<SqlHistoryCommand
							groupedHistory={groupedHistory}
							onItemClick={onHistoryItemClick}
						/>
					)}
				</TabsContent>
				<TabsContent value="tables" className={tabsContent}>
					<SqlTablesCommand
						schemas={schemas}
						onTableClick={onTableClick}
						isActive={selectedMenuTab === "tables"}
					/>
				</TabsContent>
				<TabsContent value="queries" className={tabsContent}>
					<ActiveQueriesView isActive={selectedMenuTab === "queries"} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// Toggle button

export function SqlLeftMenuToggle({
	onOpen,
	onClose,
}: {
	onOpen: () => void;
	onClose: () => void;
}) {
	const leftMenuStatus = React.useContext<LeftMenuStatus>(SqlLeftMenuContext);

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
			<TooltipContent>History</TooltipContent>
		</Tooltip>
	);
}
