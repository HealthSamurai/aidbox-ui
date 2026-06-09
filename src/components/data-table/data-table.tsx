"use no memo";

import * as HSComp from "@health-samurai/react-components";
import {
	type ColumnSizingState,
	getCoreRowModel,
	type ColumnDef as TSColumnDef,
	useReactTable,
} from "@tanstack/react-table";
import React from "react";
import { useLocalStorage } from "../../hooks";
import type { ColumnDef, DataTableProps, SortState } from "./types";

const DEFAULT_MIN_SIZE = 60;
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_SIZE = 150;
const STORAGE_PREFIX = "data-table-sizing:";

function sortedColumn(
	sort: SortState | undefined,
	column: string,
): "asc" | "desc" | undefined {
	if (sort && sort.column === column) return sort.direction;
	return undefined;
}

function ColumnHead<T>({
	column,
	sort,
	onSortToggle,
	style,
	resizeHandle,
	colId,
}: {
	column: ColumnDef<T>;
	sort: SortState | undefined;
	onSortToggle: ((column: string) => void) | undefined;
	style?: React.CSSProperties;
	resizeHandle?: React.ReactNode;
	colId?: string;
}) {
	const head = (
		<HSComp.TableHead
			className={resizeHandle ? "relative" : column.width}
			style={style}
			sortable={column.sortable}
			sorted={sortedColumn(sort, column.id)}
			data-col-id={colId}
			onClick={
				column.sortable && onSortToggle
					? () => onSortToggle(column.id)
					: undefined
			}
		>
			{resizeHandle ? (
				<span className="block truncate">{column.header}</span>
			) : (
				column.header
			)}
			{resizeHandle}
		</HSComp.TableHead>
	);

	if (!column.headerTooltip) return head;

	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>{head}</HSComp.TooltipTrigger>
			<HSComp.TooltipContent
				side="bottom"
				align="start"
				className={column.headerTooltipClassName}
			>
				{column.headerTooltip}
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

function ResizeHandle({
	onMouseDown,
	onTouchStart,
	isResizing,
	columnId,
}: {
	onMouseDown: React.MouseEventHandler;
	onTouchStart: React.TouchEventHandler;
	isResizing: boolean;
	columnId: string;
}) {
	return (
		<button
			type="button"
			aria-label={`Resize ${columnId}`}
			onMouseDown={onMouseDown}
			onTouchStart={onTouchStart}
			onClick={(e) => e.stopPropagation()}
			className={`group/resize absolute top-0 h-full w-3 cursor-col-resize select-none touch-none z-10 flex items-center justify-center ${
				isResizing ? "z-20" : ""
			}`}
			style={{ right: -6, userSelect: "none", touchAction: "none" }}
		>
			<span
				className={`block w-0.5 h-1/2 transition-colors ${
					isResizing
						? "bg-border-link"
						: "bg-transparent group-hover/header:bg-border-secondary group-hover/resize:bg-border-link!"
				}`}
			/>
		</button>
	);
}

function useSelectionHelpers<T>(
	data: T[],
	rowKey: (row: T, index: number) => string,
	selectable: boolean | undefined,
	selectedIds: Set<string> | undefined,
	onSelectionChange:
		| React.Dispatch<React.SetStateAction<Set<string>>>
		| undefined,
) {
	const allIds = data.map(rowKey);
	const allSelected =
		selectable &&
		!!selectedIds &&
		allIds.length > 0 &&
		allIds.every((id) => selectedIds.has(id));
	const someSelected =
		selectable &&
		!!selectedIds &&
		!allSelected &&
		allIds.some((id) => selectedIds.has(id));

	const toggleAll = () => {
		if (!onSelectionChange) return;
		if (allSelected) {
			onSelectionChange(new Set());
		} else {
			onSelectionChange(new Set(allIds));
		}
	};

	const toggleOne = (id: string) => {
		if (!onSelectionChange) return;
		onSelectionChange((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return { allSelected, someSelected, toggleAll, toggleOne };
}

export function DataTable<T>(props: DataTableProps<T>) {
	if (props.loading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
				</div>
			</div>
		);
	}

	if (!props.data || props.data.length === 0) {
		return <>{props.emptyState}</>;
	}

	if (props.resizable) {
		return <ResizableDataTable {...props} />;
	}
	return <SimpleDataTable {...props} />;
}

function SimpleDataTable<T>({
	data,
	columns,
	rowKey,
	selectable,
	selectedIds,
	onSelectionChange,
	sort,
	onSortToggle,
	zebra = true,
	noRowHover,
}: DataTableProps<T>) {
	const { allSelected, someSelected, toggleAll, toggleOne } =
		useSelectionHelpers(
			data,
			rowKey,
			selectable,
			selectedIds,
			onSelectionChange,
		);

	return (
		<div className="contents [&>div[data-slot=table-container]]:overflow-visible [&>div[data-slot=table-container]]:h-auto">
			<HSComp.Table zebra={zebra} stickyHeader className="typo-code">
				<HSComp.TableHeader>
					<HSComp.TableRow>
						{selectable && (
							<HSComp.TableHead className="w-[52px] min-w-[52px]">
								<HSComp.Checkbox
									size="small"
									className="border-border-primary"
									checked={
										allSelected ? true : someSelected ? "indeterminate" : false
									}
									onCheckedChange={toggleAll}
									aria-label="Select all"
								/>
							</HSComp.TableHead>
						)}
						{columns.map((column) => (
							<ColumnHead
								key={column.id}
								column={column}
								sort={sort}
								onSortToggle={onSortToggle}
							/>
						))}
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody
					className={noRowHover ? "[&_tr]:hover:bg-transparent" : undefined}
				>
					{data.map((row, index) => {
						const id = rowKey(row, index);
						const isSelected = selectedIds?.has(id) ?? false;
						return (
							<HSComp.TableRow
								key={id || index}
								zebra={zebra}
								index={index}
								selected={isSelected}
							>
								{selectable && (
									<HSComp.TableCell>
										<HSComp.Checkbox
											size="small"
											className="border-border-primary"
											checked={isSelected}
											onCheckedChange={() => toggleOne(id)}
											aria-label={`Select ${id}`}
										/>
									</HSComp.TableCell>
								)}
								{columns.map((column) => (
									<HSComp.TableCell
										key={column.id}
										className={column.className ?? column.width}
									>
										{column.cell(row)}
									</HSComp.TableCell>
								))}
							</HSComp.TableRow>
						);
					})}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}

function ResizableDataTable<T>({
	data,
	columns,
	rowKey,
	selectable,
	selectedIds,
	onSelectionChange,
	sort,
	onSortToggle,
	tableId,
	zebra = true,
	noRowHover,
}: DataTableProps<T>) {
	const { allSelected, someSelected, toggleAll, toggleOne } =
		useSelectionHelpers(
			data,
			rowKey,
			selectable,
			selectedIds,
			onSelectionChange,
		);

	const containerRef = React.useRef<HTMLDivElement>(null);

	const [persistedSizing, setPersistedSizing] =
		useLocalStorage<ColumnSizingState>({
			key: `${STORAGE_PREFIX}${tableId ?? "_unkeyed"}`,
			defaultValue: {},
		});

	const columnsById = React.useMemo(() => {
		const map = new Map<string, ColumnDef<T>>();
		for (const c of columns) map.set(c.id, c);
		return map;
	}, [columns]);

	const tsColumns = React.useMemo<TSColumnDef<T>[]>(
		() =>
			columns.map((c) => ({
				id: c.id,
				size: c.defaultSize ?? DEFAULT_SIZE,
				minSize: c.minSize ?? DEFAULT_MIN_SIZE,
				maxSize: c.maxSize ?? DEFAULT_MAX_SIZE,
				enableResizing: true,
			})),
		[columns],
	);

	const table = useReactTable({
		data,
		columns: tsColumns,
		getCoreRowModel: getCoreRowModel(),
		columnResizeMode: "onChange",
		enableColumnResizing: true,
		state: { columnSizing: persistedSizing },
		onColumnSizingChange: (updater) => {
			setPersistedSizing((prev) =>
				typeof updater === "function" ? updater(prev) : updater,
			);
		},
	});

	const needsMeasure = React.useMemo(
		() =>
			columns.filter(
				(c) => c.defaultSize == null && !(c.id in persistedSizing),
			),
		[columns, persistedSizing],
	);
	const isMeasuring = needsMeasure.length > 0;

	React.useLayoutEffect(() => {
		if (!isMeasuring) return;
		const container = containerRef.current;
		if (!container) return;
		const ths = container.querySelectorAll<HTMLTableCellElement>(
			"thead [data-col-id]",
		);
		const map = new Map<string, HTMLTableCellElement>();
		ths.forEach((th) => {
			const id = th.dataset.colId;
			if (id) map.set(id, th);
		});
		const updates: ColumnSizingState = {};
		for (const c of needsMeasure) {
			const th = map.get(c.id);
			if (!th) continue;
			const natural = th.getBoundingClientRect().width;
			updates[c.id] = Math.min(
				Math.max(natural, c.minSize ?? DEFAULT_MIN_SIZE),
				c.maxSize ?? DEFAULT_MAX_SIZE,
			);
		}
		if (Object.keys(updates).length > 0) {
			setPersistedSizing((prev) => ({ ...prev, ...updates }));
		}
	}, [isMeasuring, needsMeasure, setPersistedSizing]);

	const headerGroup = table.getHeaderGroups()[0];
	if (!headerGroup) return null;

	const resizingHeader = headerGroup.headers.find((h) =>
		h.column.getIsResizing(),
	);
	const guideLeft =
		!isMeasuring && resizingHeader
			? (selectable ? 52 : 0) +
				resizingHeader.getStart() +
				resizingHeader.getSize()
			: null;

	const tableStyle: React.CSSProperties = isMeasuring
		? { tableLayout: "auto", width: "100%" }
		: {
				tableLayout: "fixed",
				width: "100%",
				minWidth: table.getCenterTotalSize() + (selectable ? 52 : 0),
			};

	return (
		<div
			ref={containerRef}
			className="relative [&_div[data-slot=table-container]]:overflow-visible [&_div[data-slot=table-container]]:h-auto"
		>
			{guideLeft !== null && (
				<div
					className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-border-link z-30"
					style={{ left: guideLeft - 1 }}
				/>
			)}
			<HSComp.Table
				zebra={zebra}
				stickyHeader
				className="typo-code"
				style={tableStyle}
			>
				<HSComp.TableHeader>
					<HSComp.TableRow className="group/header">
						{selectable && (
							<HSComp.TableHead
								className="w-[52px] min-w-[52px]"
								style={{ width: 52 }}
							>
								<HSComp.Checkbox
									size="small"
									className="border-border-primary"
									checked={
										allSelected ? true : someSelected ? "indeterminate" : false
									}
									onCheckedChange={toggleAll}
									aria-label="Select all"
								/>
							</HSComp.TableHead>
						)}
						{headerGroup.headers.map((header) => {
							const column = columnsById.get(header.column.id);
							if (!column) return null;
							const isLast =
								header.column.getIndex() === headerGroup.headers.length - 1;
							const headStyle: React.CSSProperties | undefined = isMeasuring
								? { maxWidth: column.maxSize ?? DEFAULT_MAX_SIZE }
								: isLast
									? undefined
									: { width: header.getSize() };
							return (
								<ColumnHead
									key={column.id}
									column={column}
									sort={sort}
									onSortToggle={onSortToggle}
									style={headStyle}
									colId={column.id}
									resizeHandle={
										isMeasuring || isLast ? null : (
											<ResizeHandle
												columnId={column.id}
												onMouseDown={header.getResizeHandler()}
												onTouchStart={header.getResizeHandler()}
												isResizing={header.column.getIsResizing()}
											/>
										)
									}
								/>
							);
						})}
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody
					className={noRowHover ? "[&_tr]:hover:bg-transparent" : undefined}
				>
					{data.map((row, index) => {
						const id = rowKey(row, index);
						const isSelected = selectedIds?.has(id) ?? false;
						return (
							<HSComp.TableRow
								key={id || index}
								zebra={zebra}
								index={index}
								selected={isSelected}
							>
								{selectable && (
									<HSComp.TableCell style={{ width: 52 }}>
										<HSComp.Checkbox
											size="small"
											className="border-border-primary"
											checked={isSelected}
											onCheckedChange={() => toggleOne(id)}
											aria-label={`Select ${id}`}
										/>
									</HSComp.TableCell>
								)}
								{headerGroup.headers.map((header, idx) => {
									const column = columnsById.get(header.column.id);
									if (!column) return null;
									const isLast = idx === headerGroup.headers.length - 1;
									const cellStyle: React.CSSProperties | undefined = isMeasuring
										? { maxWidth: column.maxSize ?? DEFAULT_MAX_SIZE }
										: isLast
											? undefined
											: { width: header.getSize() };
									return (
										<HSComp.TableCell
											key={column.id}
											className={`${column.className ?? ""} truncate`}
											style={cellStyle}
										>
											{column.cell(row)}
										</HSComp.TableCell>
									);
								})}
							</HSComp.TableRow>
						);
					})}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}
