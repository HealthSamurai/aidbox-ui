import * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { InfiniteScrollSentinel } from "../../utils/infinite-scroll";

/** Rows shown at first and added per scroll step, as in the ViewDefinition result panel. */
const PAGE_SIZE = 30;

export type ResultRows = {
	columns: string[];
	rows: unknown[][];
};

export function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function formatRowCount(count: number): string {
	return `${count} ${count === 1 ? "row" : "rows"}`;
}

/**
 * The whole result is already on the client; rows enter the DOM a page at a
 * time as the user scrolls, so a large result does not stall the panel.
 * The result never changes, so a row's position is its identity.
 */
function usePagedRows(rows: unknown[][]) {
	const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
	const visibleRows = rows
		.slice(0, visibleCount)
		.map((row, index) => ({ index, row }));
	return {
		visibleRows,
		hasMore: visibleCount < rows.length,
		loadMore: () => setVisibleCount((count) => count + PAGE_SIZE),
	};
}

export function ResultTable({ columns, rows }: ResultRows) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const { visibleRows, hasMore, loadMore } = usePagedRows(rows);

	return (
		<div ref={containerRef} className="h-full">
			<HSComp.Table zebra stickyHeader className="typo-code">
				<HSComp.TableHeader className="z-0">
					<HSComp.TableRow>
						{columns.map((col) => (
							<HSComp.TableHead key={col}>{col}</HSComp.TableHead>
						))}
						<HSComp.TableHead className="w-full p-0" />
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{visibleRows.map(({ index, row }) => (
						<HSComp.TableRow key={index} zebra index={index}>
							{columns.map((col, j) => (
								<HSComp.TableCell key={col}>
									{formatCellValue(row[j])}
								</HSComp.TableCell>
							))}
							<HSComp.TableCell className="p-0" />
						</HSComp.TableRow>
					))}
				</HSComp.TableBody>
			</HSComp.Table>
			<InfiniteScrollSentinel
				root={containerRef}
				onLoadMore={loadMore}
				hasMore={hasMore}
			/>
		</div>
	);
}

/** One block per row with every column labelled; paged the same way. */
export function ResultList({ columns, rows }: ResultRows) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const { visibleRows, hasMore, loadMore } = usePagedRows(rows);

	return (
		<div ref={containerRef} className="h-full overflow-auto">
			<div className="divide-y divide-border-secondary">
				{visibleRows.map(({ index, row }) => (
					<div
						key={index}
						className="grid gap-x-4 px-6 py-3"
						style={{ gridTemplateColumns: "max-content 1fr" }}
					>
						{columns.map((col, j) => (
							<div key={col} className="contents">
								<div className="py-1 px-2 text-right text-text-secondary typo-label text-sm whitespace-nowrap">
									{col}
								</div>
								<div className="py-1 px-2 min-w-0 typo-code">
									{formatCellValue(row[j])}
								</div>
							</div>
						))}
					</div>
				))}
			</div>
			<InfiniteScrollSentinel
				root={containerRef}
				onLoadMore={loadMore}
				hasMore={hasMore}
			/>
		</div>
	);
}
