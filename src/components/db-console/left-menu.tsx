import type {
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	Button,
	CodeEditor,
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
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { format as formatSQL } from "sql-formatter";
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

const leftMenuContainer = cn("h-full", "overflow-hidden");

const tabsHeader = cn("border-b", "h-10", "bg-bg-secondary");
const tabsContent = cn("p-0", "h-full");

const commandContainer = cn(
	"h-full",
	"flex",
	"flex-col",
	"overflow-hidden",
	"[&_[data-slot=command-input-wrapper]]:flex-none",
	"[&_[data-slot=command-input-wrapper]]:h-10",
);
const commandList = cn("flex-1", "min-h-0", "max-h-none!", "p-0");
const historyGroup = cn("[&_*[cmdk-group-heading]]:px-2");

const historyItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"py-2",
	"cursor-pointer",
	"hover:bg-bg-secondary",
	"data-[selected=true]:bg-bg-secondary",
);

const toggleButton = cn(
	"h-full",
	"flex-shrink-0",
	"border-b-0",
	"border-r",
	"rounded-none!",
);
const iconSize = cn("size-4");

const SHORT_MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function formatHistoryTime(dateString: string): string {
	const d = new Date(dateString);
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

function getDateGroup(dateString: string): string {
	const date = new Date(dateString);
	return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

function groupHistoryByDate(
	items: SqlHistoryEntry[],
): Record<string, SqlHistoryEntry[]> {
	const groups: Record<string, SqlHistoryEntry[]> = {};

	for (const item of items) {
		const lastUpdated = item.meta?.lastUpdated;
		if (!lastUpdated) continue;
		const group = getDateGroup(lastUpdated);
		if (!groups[group]) groups[group] = [];
		groups[group].push(item);
	}

	return groups;
}

function getSortedGroupKeys(groups: Record<string, unknown[]>): string[] {
	return Object.keys(groups);
}

// Context

type LeftMenuStatus = "open" | "close";

const SqlLeftMenuContext = React.createContext<LeftMenuStatus>("open");
export { SqlLeftMenuContext };

// History list component

function formatGroupTitle(groupKey: string, allGroupKeys: string[]): string {
	if (allGroupKeys.length === 1) return "";
	return groupKey;
}

function SqlHistoryCommand({
	history,
	onItemClick,
	isActive,
}: {
	history: SqlHistoryEntry[];
	onItemClick: (command: string) => void;
	isActive: boolean;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const groupedHistory = useMemo(() => groupHistoryByDate(history), [history]);

	const resetScroll = useCallback(() => {
		requestAnimationFrame(() => {
			if (listRef.current) listRef.current.scrollTop = 0;
		});
	}, []);

	useEffect(() => {
		if (isActive) {
			requestAnimationFrame(() => {
				containerRef.current
					?.querySelector<HTMLInputElement>("[cmdk-input]")
					?.focus();
			});
		}
	}, [isActive]);

	const sortedKeys = getSortedGroupKeys(groupedHistory);

	return (
		<Command ref={containerRef} className={commandContainer}>
			<CommandInput
				placeholder="Search history..."
				onValueChange={resetScroll}
			/>
			<CommandList ref={listRef} className={commandList}>
				<CommandEmpty>No history found.</CommandEmpty>
				{sortedKeys.map((groupKey) => {
					const items = groupedHistory[groupKey];
					if (!items || items.length === 0) return null;

					return (
						<CommandGroup
							key={groupKey}
							heading={formatGroupTitle(groupKey, sortedKeys)}
							className={historyGroup}
						>
							{items.map((item) => {
								const normalized = item.command.trim().replace(/\s+/g, " ");
								let formatted: string;
								try {
									formatted = formatSQL(item.command, {
										language: "postgresql",
										indentStyle: "tabularRight",
									});
								} catch {
									formatted = item.command;
								}

								return (
									<Tooltip key={item.id} delayDuration={50}>
										<TooltipTrigger asChild>
											<div>
												<CommandItem
													value={`${item.id}-${normalized.toLowerCase()}`}
													onSelect={() => onItemClick(item.command)}
													className={historyItem}
												>
													<span className="typo-code text-xs! text-text-secondary truncate">
														{normalized}
													</span>
													{item.meta?.lastUpdated && (
														<span className="typo-code text-xs! text-text-tertiary shrink-0 ml-auto">
															{formatHistoryTime(item.meta.lastUpdated)}
														</span>
													)}
												</CommandItem>
											</div>
										</TooltipTrigger>
										<TooltipContent
											side="right"
											align="start"
											sideOffset={12}
											className="max-w-none px-2 pt-1 pb-2 rounded text-text-primary bg-bg-primary border border-border-secondary"
										>
											<CodeEditor
												readOnly
												currentValue={formatted}
												mode="sql"
												foldGutter={false}
												lintGutter={false}
												lineNumbers={false}
											/>
										</TooltipContent>
									</Tooltip>
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

	const history = useMemo(() => {
		if (!historyData?.entry) return [];
		return historyData.entry.flatMap((entry: BundleEntry) => {
			if (isSqlHistoryEntry(entry.resource)) return entry.resource;
			throw new Error("incorrect resource in sql history response", {
				cause: entry.resource,
			});
		});
	}, [historyData]);

	return (
		<div className={leftMenuContainer}>
			<Tabs
				value={selectedMenuTab}
				onValueChange={setSelectedMenuTab}
				className="h-full min-w-0"
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
						<div className="h-full flex items-center justify-center">
							<span className="text-text-disabled text-xl font-medium whitespace-nowrap">
								No history
							</span>
						</div>
					)}
					{history.length > 0 && (
						<SqlHistoryCommand
							history={history}
							onItemClick={onHistoryItemClick}
							isActive={
								selectedMenuTab === "history" && leftMenuStatus === "open"
							}
						/>
					)}
				</TabsContent>
				<TabsContent value="tables" className={tabsContent}>
					<SqlTablesCommand
						schemas={schemas}
						onTableClick={onTableClick}
						isActive={selectedMenuTab === "tables" && leftMenuStatus === "open"}
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
			<TooltipContent>History / Tables / Queries</TooltipContent>
		</Tooltip>
	);
}
