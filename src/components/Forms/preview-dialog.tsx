import {
	Alert,
	AlertDescription,
	Dialog,
	DialogContent,
	DialogTitle,
} from "@health-samurai/react-components";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

/** Present a preview with shared sizing and loading feedback. */
export function PreviewDialog({
	children,
	error,
	isLoading,
	onOpenChange,
	open,
	testId,
	title,
	toolbar,
}: {
	children: ReactNode;
	error?: string;
	isLoading?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	testId?: string;
	title: string;
	toolbar?: ReactNode;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="flex h-[min(90vh,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] xl:max-w-[88rem]"
				data-test-id={testId}
			>
				<DialogTitle
					className="sr-only"
					data-test-id={testId ? `${testId}__title` : undefined}
				>
					{title}
				</DialogTitle>
				{toolbar}
				{error ? (
					<div
						className="p-4"
						data-test-id={testId ? `${testId}__error` : undefined}
					>
						<Alert variant="warning">
							<AlertCircle className="size-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					</div>
				) : null}
				{children}
				{isLoading ? (
					<div
						className="flex flex-1 items-center justify-center bg-bg-primary px-4 py-6 text-sm text-text-secondary"
						data-test-id={testId ? `${testId}__loading` : undefined}
					>
						Loading preview…
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
