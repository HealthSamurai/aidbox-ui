import type { ReactNode } from "react";

export const EmptyState = ({
	title,
	description,
}: {
	title: ReactNode;
	description?: ReactNode;
}) => {
	return (
		<div className="flex items-center justify-center h-full">
			<div className="flex flex-col items-center gap-6">
				<img src="/no-resources.svg" alt="" />
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
