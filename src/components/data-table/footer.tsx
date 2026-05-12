import * as HSComp from "@health-samurai/react-components";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { PaginationPages } from "./pagination";
import type { BulkAction, DataTableFooterProps } from "./types";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function BulkActionButton({
	action,
	disabled,
}: {
	action: BulkAction;
	disabled?: boolean;
}) {
	const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

	const handleClick = () => {
		if (action.confirm) {
			setIsConfirmOpen(true);
		} else {
			action.onClick();
		}
	};

	const button = (
		<HSComp.Button
			variant="ghost"
			size="small"
			className="text-text-secondary!"
			disabled={disabled || action.disabled}
			onClick={handleClick}
		>
			{action.icon}
			{action.label}
		</HSComp.Button>
	);

	if (!action.confirm) return button;

	return (
		<>
			{button}
			<HSComp.AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>
							{action.confirm.title}
						</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					{action.confirm.description && (
						<HSComp.AlertDialogDescription>
							{action.confirm.description}
						</HSComp.AlertDialogDescription>
					)}
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger={action.variant === "danger"}
							onClick={() => {
								action.onClick();
								setIsConfirmOpen(false);
							}}
						>
							{action.icon}
							{action.confirm.actionLabel ?? action.label}
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</>
	);
}

export function DataTableFooter({
	total,
	currentPage,
	pageSize,
	pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
	selectedCount,
	bulkActions,
	onPageChange,
	onPageSizeChange,
}: DataTableFooterProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="flex items-center justify-between border-t bg-bg-secondary px-4 h-10">
			<div className="flex items-center gap-4">
				{selectedCount > 0 && bulkActions && bulkActions.length > 0 && (
					<>
						<span className="typo-default text-text-primary">
							{selectedCount} selected:
						</span>
						{bulkActions.map((action) => (
							<BulkActionButton key={action.id} action={action} />
						))}
					</>
				)}
			</div>
			<div className="flex items-center gap-4">
				<HSComp.DropdownMenu>
					<HSComp.DropdownMenuTrigger asChild>
						<HSComp.Button variant="ghost" size="small">
							{pageSize}/page
							<ChevronDownIcon size={14} />
						</HSComp.Button>
					</HSComp.DropdownMenuTrigger>
					<HSComp.DropdownMenuContent align="end">
						{pageSizeOptions.map((size) => (
							<HSComp.DropdownMenuItem
								key={size}
								onClick={() => onPageSizeChange(size)}
							>
								{size}/page
							</HSComp.DropdownMenuItem>
						))}
					</HSComp.DropdownMenuContent>
				</HSComp.DropdownMenu>
				<PaginationPages
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={onPageChange}
				/>
			</div>
		</div>
	);
}
