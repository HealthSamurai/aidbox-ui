"use no memo";

import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { useLocalStorage } from "../../hooks";
import type { ColumnDef, DataTableProps, SortState } from "./types";

const DEFAULT_MIN_SIZE = 60;
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_SIZE = 150;
const STORAGE_PREFIX = "data-table-sizing:v2:";

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
	wrapperStyle,
	resizeHandle,
	colId,
}: {
	column: ColumnDef<T>;
	sort: SortState | undefined;
	onSortToggle: ((column: string) => void) | undefined;
	wrapperStyle?: React.CSSProperties;
	resizeHandle?: React.ReactNode;
	colId?: string;
}) {
	const head = (
		<HSComp.TableHead
			className={resizeHandle ? "relative" : column.width}
			sortable={column.sortable}
			sorted={sortedColumn(sort, column.id)}
			data-col-id={colId}
			onClick={
				column.sortable && onSortToggle
					? () => onSortToggle(column.id)
					: undefined
			}
		>
			{wrapperStyle ? (
				<span className="block truncate" style={wrapperStyle}>
					{column.header}
				</span>
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
	onPointerDown,
	isResizing,
	columnId,
}: {
	onPointerDown: React.PointerEventHandler;
	isResizing: boolean;
	columnId: string;
}) {
	return (
		<button
			type="button"
			aria-label={`Resize ${columnId}`}
			onPointerDown={onPointerDown}
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
	renderExpandedRow,
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
	const colWidthsRef = React.useRef<Record<string, number>>({});

	const [persistedSizing, setPersistedSizing] = useLocalStorage<
		Record<string, number>
	>({
		key: `${STORAGE_PREFIX}${tableId ?? "_unkeyed"}`,
		defaultValue: {},
	});

	const [resizingId, setResizingId] = React.useState<string | null>(null);
	const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(
		() => new Set(),
	);
	const toggleRow = (id: string) =>
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	const expandable = !!renderExpandedRow;
	const expandColSpan = columns.length + (selectable ? 1 : 0) + 1;
	const [expandedWidth, setExpandedWidth] = React.useState<number | undefined>(
		undefined,
	);

	React.useLayoutEffect(() => {
		if (!expandable) return;
		const scroller = containerRef.current?.parentElement;
		if (!scroller) return;
		const update = () => setExpandedWidth(scroller.clientWidth);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(scroller);
		return () => ro.disconnect();
	}, [expandable]);

	React.useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const ths = container.querySelectorAll<HTMLTableCellElement>(
			"thead [data-col-id]",
		);
		ths.forEach((th) => {
			const id = th.dataset.colId;
			if (id) colWidthsRef.current[id] = th.getBoundingClientRect().width;
		});
	});

	const wrapperStyle = (column: ColumnDef<T>): React.CSSProperties => {
		const fixed = persistedSizing[column.id];
		if (fixed != null) {
			return { width: fixed, minWidth: fixed, maxWidth: fixed };
		}
		return {
			minWidth: column.minSize ?? DEFAULT_MIN_SIZE,
			maxWidth: column.maxSize ?? DEFAULT_MAX_SIZE,
		};
	};

	const startResize = (column: ColumnDef<T>) => (e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW =
			persistedSizing[column.id] ??
			colWidthsRef.current[column.id] ??
			DEFAULT_SIZE;
		const minS = column.minSize ?? DEFAULT_MIN_SIZE;
		const maxS = column.maxSize ?? DEFAULT_MAX_SIZE;
		setResizingId(column.id);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		const onMove = (ev: PointerEvent) => {
			const w = Math.min(Math.max(startW + (ev.clientX - startX), minS), maxS);
			setPersistedSizing((prev) => ({ ...prev, [column.id]: w }));
		};
		const onUp = () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			setResizingId(null);
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	};

	return (
		<div
			ref={containerRef}
			className="relative [&_div[data-slot=table-container]]:overflow-visible [&_div[data-slot=table-container]]:h-auto"
		>
			<HSComp.Table
				zebra={zebra}
				stickyHeader
				className="typo-code"
				style={{ tableLayout: "auto", width: "100%" }}
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
						{columns.map((column) => (
							<ColumnHead
								key={column.id}
								column={column}
								sort={sort}
								onSortToggle={onSortToggle}
								colId={column.id}
								wrapperStyle={wrapperStyle(column)}
								resizeHandle={
									<ResizeHandle
										columnId={column.id}
										isResizing={resizingId === column.id}
										onPointerDown={startResize(column)}
									/>
								}
							/>
						))}
						<HSComp.TableHead aria-hidden style={{ width: "100%" }} />
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody
					className={noRowHover ? "[&_tr]:hover:bg-transparent" : undefined}
				>
					{data.map((row, index) => {
						const id = rowKey(row, index);
						const isSelected = selectedIds?.has(id) ?? false;
						const isExpanded = expandable && expandedKeys.has(id);
						return (
							<React.Fragment key={id || index}>
								<HSComp.TableRow
									zebra={zebra}
									index={index}
									selected={isSelected}
									className={expandable ? "cursor-pointer" : undefined}
									onClick={expandable ? () => toggleRow(id) : undefined}
								>
									{selectable && (
										<HSComp.TableCell
											style={{ width: 52 }}
											onClick={(e) => e.stopPropagation()}
										>
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
											className={column.className}
										>
											<div className="truncate" style={wrapperStyle(column)}>
												{column.cell(row)}
											</div>
										</HSComp.TableCell>
									))}
									<HSComp.TableCell aria-hidden />
								</HSComp.TableRow>
								{isExpanded && renderExpandedRow ? (
									<HSComp.TableRow className="hover:bg-transparent!">
										<HSComp.TableCell colSpan={expandColSpan} className="p-0">
											<div
												className="sticky left-0"
												style={{ width: expandedWidth }}
											>
												{renderExpandedRow(row)}
											</div>
										</HSComp.TableCell>
									</HSComp.TableRow>
								) : null}
							</React.Fragment>
						);
					})}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}
