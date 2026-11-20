import { useOperationOutcomeIssues } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import { useSortable } from "@dnd-kit/react/sortable";
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
} from "@health-samurai/react-components";
import { CircleAlert, Copy, EllipsisVertical, Eye, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import {
	GRAPH_CARD_WIDTH,
	type GraphForm,
} from "./plan-definition-graph-layout";

export function GraphFormBlock({
	form,
	title,
	conditional,
	selected,
	disabled,
	invalid: localInvalid,
	sorting,
	scale,
	onSelect,
	onQuickLook,
	onDuplicate,
	onDelete,
}: {
	form: GraphForm;
	title: string;
	conditional: boolean;
	selected: boolean;
	disabled: boolean;
	invalid: boolean;
	sorting: boolean;
	scale: number;
	onSelect: () => void;
	onQuickLook?: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	const invalid =
		useOperationOutcomeIssues(
			new RegExp(`^PlanDefinition\\.action\\[${form.index}\\](?:\\.|\\[|$)`),
			{
				severity: ["error", "fatal"],
			},
		).length > 0 || localInvalid;
	const { ref, handleRef, isDragging } = useSortable({
		id: form.key,
		index: form.index,
		disabled,
	});
	const hasBody = form.items.length > 0 || Boolean(form.message);
	return (
		<li
			ref={ref}
			data-test-id="plan-definition-graph__form-node"
			data-action-index={form.index}
			data-action-key={form.key}
			aria-label={`Form ${form.index + 1}: ${title}`}
			aria-current={selected ? "step" : undefined}
			className={cn(
				"relative rounded-lg border border-border-primary bg-bg-primary shadow-sm transition-colors data-[dnd-dragging]:origin-top-left data-[dnd-dragging]:[scale:var(--graph-scale)]",
				!selected &&
					!invalid &&
					!disabled &&
					"hover:border-border-primary_hover",
				selected && "border-border-brand ring-1 ring-border-brand",
				invalid && "border-border-error",
				isDragging && "z-30 shadow-lg",
			)}
			style={
				{
					width: GRAPH_CARD_WIDTH,
					height: form.height,
					// Drag feedback moves into the top layer, outside the scaled viewport.
					// Keep its original dimensions and apply the viewport scale there.
					maxWidth: "none",
					maxHeight: "none",
					"--graph-scale": scale,
				} as CSSProperties
			}
		>
			<Button
				ref={handleRef}
				type="button"
				variant="ghost"
				className="block h-full w-full cursor-grab touch-none select-none whitespace-normal rounded-lg p-0 text-left text-text-primary hover:bg-transparent active:cursor-grabbing active:bg-transparent focus-visible:ring-inset"
				aria-label={`${title}${invalid ? ", Form has errors" : ""}`}
				aria-description={conditional ? "Conditional form" : undefined}
				aria-current={selected ? "step" : undefined}
				data-test-id="plan-definition-graph__form-button"
				disabled={disabled}
				onClick={() => {
					if (!sorting) onSelect();
				}}
			>
				<span
					data-graph-anchor={form.anchor}
					className={cn(
						"flex items-center gap-2 bg-bg-secondary pl-4 pr-20",
						hasBody
							? "rounded-t-lg border-b border-border-secondary"
							: "rounded-lg",
					)}
					style={{ height: form.headingHeight }}
				>
					<span
						className={cn(
							"flex size-8 shrink-0 items-center justify-center rounded-md border border-border-primary text-lg font-bold leading-none text-text-primary tabular-nums",
							conditional ? "bg-bg-link/10" : "bg-bg-primary",
						)}
					>
						{form.index + 1}
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-xs font-normal text-text-secondary">
							{conditional ? "Conditional form" : "Form"}
						</span>
						<span
							className="block truncate text-sm font-semibold"
							title={title}
						>
							{title}
						</span>
					</span>
					{invalid && (
						<CircleAlert
							role="img"
							className="size-4 shrink-0 text-text-error-primary"
							aria-label="Form has errors"
						/>
					)}
				</span>
				{hasBody && (
					<span className="block p-4">
						{form.message && (
							<output className="block h-8 text-xs text-text-secondary">
								{form.message}
							</output>
						)}
						<span className="block space-y-2">
							{form.items.map((item) => (
								<span
									key={item.anchor}
									data-graph-anchor={item.anchor}
									data-test-id="plan-definition-graph__item-node"
									data-link-id={item.linkId}
									className="flex items-center gap-2 rounded border border-border-primary bg-bg-secondary px-3"
									style={{ height: item.height }}
								>
									<span
										className="min-w-0 flex-1 truncate text-xs text-text-primary"
										title={item.label}
									>
										{item.label}
									</span>
								</span>
							))}
						</span>
					</span>
				)}
			</Button>
			<div
				className="absolute right-2 flex -translate-y-1/2 gap-1"
				style={{ top: form.headingHeight / 2 }}
			>
				<IconButton
					variant="ghost"
					aria-label={`Quick look at ${title}`}
					title={`Quick look at ${title}`}
					data-test-id="plan-definition-graph__quick-look-button"
					disabled={disabled || sorting || !onQuickLook}
					onClick={onQuickLook}
					icon={<Eye className="size-4" />}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<IconButton
							variant="ghost"
							aria-label={`Open actions for ${title}`}
							data-test-id="plan-definition-editor__action-menu-button"
							disabled={disabled || sorting}
							icon={<EllipsisVertical className="size-4" />}
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="justify-start"
							data-test-id="plan-definition-editor__action-menu-duplicate-button"
							onClick={onDuplicate}
						>
							<Copy className="size-4" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							className="justify-start"
							data-test-id="plan-definition-editor__action-menu-delete-button"
							onClick={onDelete}
						>
							<Trash2 className="size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}
