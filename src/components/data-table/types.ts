import type * as React from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
	column: string;
	direction: SortDirection;
} | null;

export type ColumnDef<T> = {
	id: string;
	header: React.ReactNode;
	headerTooltip?: React.ReactNode;
	cell: (row: T) => React.ReactNode;
	width?: string;
	className?: string;
	sortable?: boolean;
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

export type DataTableProps<T> = {
	data: T[];
	columns: ColumnDef<T>[];
	rowKey: (row: T) => string;
	loading?: boolean;
	emptyState?: React.ReactNode;
	selectable?: boolean;
	selectedIds?: Set<string>;
	onSelectionChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
	sort?: SortState;
	onSortToggle?: (column: string) => void;
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
