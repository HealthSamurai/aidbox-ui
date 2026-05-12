import * as HSComp from "@health-samurai/react-components";
import type { ColumnDef, DataTableProps, SortState } from "./types";

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
}: {
	column: ColumnDef<T>;
	sort: SortState | undefined;
	onSortToggle: ((column: string) => void) | undefined;
}) {
	const head = (
		<HSComp.TableHead
			className={column.width}
			sortable={column.sortable}
			sorted={sortedColumn(sort, column.id)}
			onClick={
				column.sortable && onSortToggle
					? () => onSortToggle(column.id)
					: undefined
			}
		>
			{column.header}
		</HSComp.TableHead>
	);

	if (!column.headerTooltip) return head;

	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>{head}</HSComp.TooltipTrigger>
			<HSComp.TooltipContent side="bottom" align="start">
				{column.headerTooltip}
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

export function DataTable<T>({
	data,
	columns,
	rowKey,
	loading,
	emptyState,
	selectable,
	selectedIds,
	onSelectionChange,
	sort,
	onSortToggle,
}: DataTableProps<T>) {
	if (loading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
				</div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return <>{emptyState}</>;
	}

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

	return (
		<HSComp.Table zebra stickyHeader className="typo-code">
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
			<HSComp.TableBody>
				{data.map((row, index) => {
					const id = rowKey(row);
					const isSelected = selectedIds?.has(id) ?? false;
					return (
						<HSComp.TableRow
							key={id || index}
							zebra
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
	);
}
