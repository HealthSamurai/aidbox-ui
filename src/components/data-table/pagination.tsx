import * as HSComp from "@health-samurai/react-components";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type PaginationPagesProps = {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
};

export function PaginationPages({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationPagesProps) {
	const pages: (number | string)[] = [];

	if (totalPages <= 7) {
		for (let i = 1; i <= totalPages; i++) pages.push(i);
	} else {
		pages.push(1);
		if (currentPage > 3) pages.push("ellipsis-start");
		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (currentPage < totalPages - 2) pages.push("ellipsis-end");
		pages.push(totalPages);
	}

	return (
		<div className="flex items-center gap-1">
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage <= 1}
				onClick={() => onPageChange(currentPage - 1)}
			>
				<ChevronLeftIcon size={16} />
			</HSComp.Button>
			{pages.map((page) =>
				typeof page === "string" ? (
					<span key={page} className="px-1 text-elements-assistive">
						...
					</span>
				) : (
					<HSComp.Button
						key={page}
						variant={page === currentPage ? "secondary" : "ghost"}
						size="small"
						onClick={() => onPageChange(page)}
					>
						{page}
					</HSComp.Button>
				),
			)}
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage >= totalPages}
				onClick={() => onPageChange(currentPage + 1)}
			>
				<ChevronRightIcon size={16} />
			</HSComp.Button>
		</div>
	);
}
