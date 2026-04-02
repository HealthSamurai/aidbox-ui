import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import {
	Button,
	CodeEditor,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { InfiniteScrollSentinel } from "../../utils/infinite-scroll";
import { EmptyState } from "../empty-state";
import { ViewDefinitionContext } from "./page";
import { SQLTab } from "./sql-tab-content";

const SKELETON_MARKER = "__skeleton__";

interface ProcessedTableData {
	tableData: Record<string, unknown>[];
	columns: string[];
	isEmptyArray: boolean;
}

const parseResponse = (
	response: string | undefined,
): Record<string, unknown>[] | null => {
	if (!response) {
		return null;
	}

	try {
		const parsed = JSON.parse(response);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const extractColumnsFromData = (data: unknown[]): string[] => {
	const allKeys = new Set<string>();
	for (const row of data) {
		if (typeof row === "object" && row !== null) {
			for (const key of Object.keys(row)) allKeys.add(key);
		}
	}
	return Array.from(allKeys);
};

const extractColumnOrder = (
	selectItems: ViewDefinition["select"] | undefined,
): string[] => {
	if (!selectItems) return [];
	const names: string[] = [];
	for (const item of selectItems) {
		if (item.column) {
			for (const col of item.column) {
				if (col.name) names.push(col.name);
			}
		}
		if (item.select) {
			names.push(...extractColumnOrder(item.select));
		}
		if (item.unionAll) {
			names.push(...extractColumnOrder(item.unionAll));
		}
	}
	return names;
};

const sortColumnsByDefinition = (
	columns: string[],
	definitionOrder: string[],
): string[] => {
	const orderMap = new Map(definitionOrder.map((name, i) => [name, i]));
	return [...columns].sort((a, b) => {
		const ai = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
		const bi = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
		return ai - bi;
	});
};

const processTableData = (
	response: string | undefined,
	viewDefinition?: ViewDefinition,
): ProcessedTableData => {
	const parsedData = parseResponse(response);

	if (!parsedData) {
		return { tableData: [], columns: [], isEmptyArray: false };
	}

	if (parsedData.length === 0) {
		return { tableData: [], columns: [], isEmptyArray: true };
	}

	const columns = extractColumnsFromData(parsedData);
	const definitionOrder = extractColumnOrder(viewDefinition?.select);
	const sortedColumns =
		definitionOrder.length > 0
			? sortColumnsByDefinition(columns, definitionOrder)
			: columns;
	return { tableData: parsedData, columns: sortedColumns, isEmptyArray: false };
};

const ResultHeader = ({
	isMaximized,
	onToggleMaximize,
	onToggleCollapse,
}: {
	isMaximized: boolean;
	onToggleMaximize: () => void;
	onToggleCollapse: () => void;
}) => (
	<div className="flex gap-1 items-center justify-between bg-bg-secondary px-4 pr-2 border-b h-10">
		<div className="flex items-center">
			<TabsList>
				<TabsTrigger value="result">Result</TabsTrigger>
				<TabsTrigger value="sql">SQL</TabsTrigger>
			</TabsList>
		</div>
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="small" onClick={onToggleCollapse}>
						<PanelBottomClose className="w-4 h-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent align="end">Collapse</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="small" onClick={onToggleMaximize}>
						{isMaximized ? (
							<Minimize2 className="w-4 h-4" />
						) : (
							<Maximize2 className="w-4 h-4" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent align="end">
					{isMaximized ? "Minimize" : "Maximize"}
				</TooltipContent>
			</Tooltip>
		</div>
	</div>
);

const CellValue = ({ value }: { value: unknown }) => {
	if (value === null || value === undefined) {
		return <span className="text-text-tertiary">null</span>;
	}
	return <>{String(value)}</>;
};

const ResultContent = ({
	rows,
	isEmptyArray,
	accumulatedData,
	columns,
	hasMore,
	isLoadingMore,
	onLoadMore,
	containerRef,
	pageSize,
}: {
	rows: string | undefined;
	isEmptyArray: boolean;
	accumulatedData: Record<string, unknown>[];
	columns: string[];
	hasMore: boolean;
	isLoadingMore: boolean;
	onLoadMore: () => void;
	containerRef: RefObject<HTMLDivElement | null>;
	pageSize: number;
}) => {
	if (!rows) {
		return (
			<EmptyState
				title="No results yet"
				description="Click Run to execute the ViewDefinition"
			/>
		);
	}

	if (isEmptyArray) {
		return (
			<EmptyState
				title="No results"
				description="The query executed successfully but returned no data"
			/>
		);
	}

	if (accumulatedData.length > 0) {
		const skeletonRows = isLoadingMore
			? Array.from({ length: pageSize }, () => ({ [SKELETON_MARKER]: true }))
			: [];
		const displayData = isLoadingMore
			? [...accumulatedData, ...skeletonRows]
			: accumulatedData;

		return (
			<div ref={containerRef} className="flex-1 overflow-auto min-h-0">
				<Table zebra stickyHeader className="typo-code">
					<TableHeader>
						<TableRow>
							{columns.map((key, i) => (
								<TableHead
									key={key}
									className={`px-6 hover:bg-transparent ${i < columns.length - 1 ? "w-0 whitespace-nowrap" : ""}`}
								>
									{key}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody className="[&_tr]:hover:bg-transparent">
						{displayData.map((row, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: result rows lack stable unique identifiers
							<TableRow key={index} zebra index={index}>
								{columns.map((key, i) => (
									<TableCell
										key={key}
										className={`px-6 ${i < columns.length - 1 ? "w-0 whitespace-nowrap" : ""}`}
									>
										{row[SKELETON_MARKER] ? (
											<Skeleton className="h-4 w-3/4" />
										) : (
											<CellValue
												value={(row as Record<string, unknown>)[key]}
											/>
										)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
				<InfiniteScrollSentinel
					root={containerRef}
					onLoadMore={onLoadMore}
					hasMore={hasMore}
					isLoading={isLoadingMore}
				/>
			</div>
		);
	}

	return (
		<div className="flex-1 p-4">
			<CodeEditor readOnly={true} currentValue={rows} mode="json" />
		</div>
	);
};

export function ResultPanel({
	onToggleCollapse,
}: {
	onToggleCollapse?: () => void;
}) {
	const client = useAidboxClient();

	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const rows = viewDefinitionContext.runResult;
	const [isMaximized, setIsMaximized] = useState(false);

	const {
		tableData,
		columns: initialColumns,
		isEmptyArray,
	} = useMemo(
		() => processTableData(rows, viewDefinitionContext.runViewDefinition),
		[rows, viewDefinitionContext.runViewDefinition],
	);

	const [accumulatedData, setAccumulatedData] = useState<
		Record<string, unknown>[]
	>([]);
	const [columns, setColumns] = useState<string[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const pageRef = useRef(1);
	const runIdRef = useRef(0);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		runIdRef.current += 1;
		setAccumulatedData(tableData);
		setColumns(initialColumns);
		pageRef.current = 1;
		const pageSize = viewDefinitionContext.runResultPageSize || 30;
		setHasMore(tableData.length >= pageSize);
	}, [tableData, initialColumns, viewDefinitionContext.runResultPageSize]);

	const loadMoreMutation = useMutation({
		mutationFn: ({
			viewDefinition,
			page,
			pageSize,
		}: {
			viewDefinition: ViewDefinition;
			page: number;
			pageSize: number;
			runId: number;
		}) => {
			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{ name: "viewResource", resource: viewDefinition },
					{ name: "_format", valueCode: "json" },
					{ name: "_limit", valueInteger: pageSize },
					{ name: "_page", valueInteger: page },
				],
			};
			return client.rawRequest({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: async (data: AidboxTypes.ResponseWithMeta, variables) => {
			if (variables.runId !== runIdRef.current) return;
			const decodedData = atob((await data.response.json()).data);
			const { tableData: newRows } = processTableData(decodedData);
			setAccumulatedData((prev) => [...prev, ...newRows]);
			const pageSize = viewDefinitionContext.runResultPageSize || 30;
			setHasMore(newRows.length >= pageSize);
		},
		onError: Utils.onMutationError,
	});

	const handleLoadMore = useCallback(() => {
		if (loadMoreMutation.isPending || !hasMore) return;
		if (!viewDefinitionContext.runViewDefinition) return;
		const nextPage = pageRef.current + 1;
		pageRef.current = nextPage;
		loadMoreMutation.mutate({
			viewDefinition: viewDefinitionContext.runViewDefinition,
			page: nextPage,
			pageSize: viewDefinitionContext.runResultPageSize || 30,
			runId: runIdRef.current,
		});
	}, [
		loadMoreMutation,
		hasMore,
		viewDefinitionContext.runViewDefinition,
		viewDefinitionContext.runResultPageSize,
	]);

	const toggleMaximize = () => {
		setIsMaximized((prev) => !prev);
	};

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isMaximized) {
				setIsMaximized(false);
			}
		};

		if (isMaximized) {
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isMaximized]);

	return (
		<Tabs defaultValue="result" className="h-full">
			<div
				className={`flex flex-col h-full ${isMaximized ? "absolute top-0 bottom-0 h-full w-full left-0 z-30 overflow-auto bg-bg-primary" : ""}`}
			>
				<ResultHeader
					isMaximized={isMaximized}
					onToggleMaximize={toggleMaximize}
					onToggleCollapse={onToggleCollapse || (() => {})}
				/>
				<TabsContent value="result" className="flex-1 min-h-0 flex flex-col">
					<ResultContent
						rows={rows}
						isEmptyArray={isEmptyArray}
						accumulatedData={accumulatedData}
						columns={columns}
						hasMore={hasMore}
						isLoadingMore={loadMoreMutation.isPending}
						onLoadMore={handleLoadMore}
						containerRef={containerRef}
						pageSize={viewDefinitionContext.runResultPageSize || 30}
					/>
				</TabsContent>
				<TabsContent value="sql" className="flex-1 min-h-0">
					<SQLTab />
				</TabsContent>
			</div>
		</Tabs>
	);
}
