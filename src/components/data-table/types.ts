import type * as React from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
	column: string;
	direction: SortDirection;
} | null;

/** `data-*` attributes, e.g. `{ "data-test-id": "forms-table__row" }`. */
export type DataAttributes = {
	[key: `data-${string}`]: string | number | boolean | undefined;
};

export type ColumnDef<T> = {
	id: string;
	header: React.ReactNode;
	headerTooltip?: React.ReactNode;
	headerTooltipClassName?: string;
	/** Classes for the header cell only; `className` styles the body cells. */
	headerClassName?: string;
	/** `data-*` attributes for the header cell, for tests to target. */
	headerProps?: DataAttributes;
	cell: (row: T) => React.ReactNode;
	/** `data-*` attributes for this column's body cell in every row. */
	cellProps?: (row: T) => DataAttributes;
	width?: string;
	className?: string;
	sortable?: boolean;
	reverseIcon?: boolean;
	grow?: boolean;
	defaultSize?: number;
	minSize?: number;
	maxSize?: number;
	/**
	 * Fixed width for a column of controls — a checkbox, a pin, a chevron. Its
	 * cell holds the content directly, without the truncating sizing wrapper.
	 */
	fixedSize?: number;
	/** Set false to leave a column out of resizing. @default true */
	resizable?: boolean;
};

export type BulkAction = {
	id: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	onClick: () => void | Promise<void>;
	variant?: "default" | "danger";
	disabled?: boolean;
	confirm?: {
		title: React.ReactNode;
		description?: React.ReactNode;
		actionLabel?: React.ReactNode;
	};
};

export type RowProps = { className?: string } & DataAttributes;

export type DataTableProps<T> = {
	data: T[];
	columns: ColumnDef<T>[];
	rowKey: (row: T, index: number) => string;
	loading?: boolean;
	emptyState?: React.ReactNode;
	selectable?: boolean;
	selectedIds?: Set<string>;
	onSelectionChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
	sort?: SortState;
	onSortToggle?: (column: string) => void;
	resizable?: boolean;
	tableId?: string;
	zebra?: boolean;
	noRowHover?: boolean;
	renderExpandedRow?: (row: T) => React.ReactNode;
	onRowClick?: (row: T) => void;
	/**
	 * Classes and `data-*` attributes of a row, for rows that differ from one
	 * another: a test id per resource type, a hover group, a card border.
	 */
	rowProps?: (row: T, index: number) => RowProps;
	/**
	 * Draws a row as a single cell spanning every column instead of the columns:
	 * a spacer, a loading or error line, "this group is empty". Return
	 * `undefined` for an ordinary row.
	 */
	fullWidthRow?: (row: T) => React.ReactNode | undefined;
};

export type DataTableFooterProps = {
	total: number;
	currentPage: number;
	pageSize: number;
	pageSizeOptions?: number[];
	selectedCount: number;
	bulkActions?: BulkAction[];
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
};
