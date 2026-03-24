import type {
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	Button,
	CodeEditor,
	Skeleton,
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
import type { SchemaMap } from "./utils";

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

const historyItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"py-1.5",
	"px-2",
	"rounded",
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

const HISTORY_PAGE_SIZE = 50;

function SqlHistoryCommand({
	history,
	onItemClick,
	isActive,
}: {
	history: SqlHistoryEntry[];
	onItemClick: (command: string) => void;
	isActive: boolean;
}) {
	const [search, setSearch] = React.useState("");
	const [visibleCount, setVisibleCount] = React.useState(HISTORY_PAGE_SIZE);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isActive) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isActive]);

	const filtered = useMemo(() => {
		if (!search) return history;
		const lower = search.toLowerCase();
		return history.filter((item) => item.command.toLowerCase().includes(lower));
	}, [history, search]);

	const visible = filtered.slice(0, visibleCount);

	const handleScroll = useCallback(() => {
		const el = listRef.current;
		if (!el) return;
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
			setVisibleCount((c) => Math.min(c + HISTORY_PAGE_SIZE, filtered.length));
		}
	}, [filtered.length]);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setSearch(e.target.value);
			setVisibleCount(HISTORY_PAGE_SIZE);
			if (listRef.current) listRef.current.scrollTop = 0;
		},
		[],
	);

	const groupedVisible = useMemo(() => groupHistoryByDate(visible), [visible]);
	const sortedKeys = getSortedGroupKeys(groupedVisible);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<div className="flex-none h-10 border-b px-3 flex items-center">
				<input
					ref={inputRef}
					value={search}
					onChange={handleSearchChange}
					placeholder="Search history..."
					className="w-full bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
				/>
			</div>
			<div
				ref={listRef}
				className="flex-1 min-h-0 overflow-auto pt-1"
				onScroll={handleScroll}
			>
				{filtered.length === 0 && (
					<div className="p-4 text-center typo-body-xs text-text-tertiary">
						No history found.
					</div>
				)}
				{sortedKeys.map((groupKey) => {
					const items = groupedVisible[groupKey];
					if (!items || items.length === 0) return null;

					return (
						<div key={groupKey} className="pl-1 pr-3">
							<div className="pl-2 pt-3 pb-2 typo-label-xs text-text-tertiary uppercase">
								{groupKey}
							</div>
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
											<button
												type="button"
												onClick={() => onItemClick(item.command)}
												className={`${historyItem} w-full`}
											>
												<span className="typo-code text-text-body truncate">
													{normalized}
												</span>
												{item.meta?.lastUpdated && (
													<span className="typo-code text-xs! text-text-tertiary shrink-0 ml-auto">
														{formatHistoryTime(item.meta.lastUpdated)}
													</span>
												)}
											</button>
										</TooltipTrigger>
										<TooltipContent
											side="right"
											align="start"
											sideOffset={20}
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
						</div>
					);
				})}
			</div>
		</div>
	);
}

// Main left menu

export function SqlLeftMenu({
	schemas,
	onHistoryItemClick,
	onTableClick,
}: {
	schemas: SchemaMap;
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
						<div className="h-full flex flex-col overflow-hidden">
							<div className="flex-none h-10 border-b px-3 flex items-center">
								<input
									disabled
									placeholder="Search history..."
									className="w-full bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
								/>
							</div>
							<div className="flex flex-col pt-1 pl-1 pr-3">
								{Array.from({ length: 20 }, (_, i) => (
									<div
										key={`sk${String(i)}`}
										className="flex items-center gap-2 py-2 px-2"
									>
										<Skeleton
											className="h-3.5 rounded"
											style={{ width: `${40 + ((i * 31) % 45)}%` }}
										/>
										<Skeleton className="h-3.5 w-8 rounded shrink-0 ml-auto" />
									</div>
								))}
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
