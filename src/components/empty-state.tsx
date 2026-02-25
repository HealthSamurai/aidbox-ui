import type { ReactNode } from "react";

export const EmptyState = ({
	title,
	description,
	grayscale,
}: {
	title: ReactNode;
	description?: ReactNode;
	grayscale?: boolean;
}) => {
	return (
		<div className="flex items-center justify-center h-full overflow-auto min-h-0">
			<div className="flex flex-col items-center gap-6 shrink-0 py-6">
				<img
					src="/no-resources.svg"
					alt=""
					className={`max-h-40 ${grayscale ? "grayscale" : ""}`}
				/>
				<div className="flex flex-col items-center gap-1">
					<span className="text-lg font-semibold">{title}</span>
					{description && (
						<span className="text-text-secondary">{description}</span>
					)}
				</div>
			</div>
		</div>
	);
};
