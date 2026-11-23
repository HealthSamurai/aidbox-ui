import { useOperationOutcomeIssues } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
} from "@health-samurai/react-components";
import {
	Handle,
	type NodeProps,
	Position,
	useUpdateNodeInternals,
} from "@xyflow/react";
import { CircleAlert, Copy, EllipsisVertical, Eye, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { GRAPH_CARD_WIDTH } from "./plan-definition-graph-layout";
import { type FormNode, graphHandleId } from "./plan-definition-graph-types";

const PORT_STYLE = {
	width: 0,
	height: 0,
	minWidth: 0,
	minHeight: 0,
	border: 0,
	background: "transparent",
};

/** Invisible rule ports on both sides of a row; React Flow measures them from the DOM. */
function RulePorts({ anchor }: { anchor: string }) {
	return (["left", "right"] as const).flatMap((side) =>
		(["source", "target"] as const).map((type) => (
			<Handle
				key={`${side}-${type}`}
				id={graphHandleId(anchor, side, type)}
				type={type}
				position={side === "left" ? Position.Left : Position.Right}
				isConnectable={false}
				style={PORT_STYLE}
			/>
		)),
	);
}

export function GraphFormNode({ id, data }: NodeProps<FormNode>) {
	const {
		form,
		title,
		conditional,
		selected,
		disabled,
		sorting,
		dragging,
		onSelect,
		onQuickLook,
		onDuplicate,
		onDelete,
		onMove,
	} = data;
	const invalid =
		useOperationOutcomeIssues(
			new RegExp(`^PlanDefinition\\.action\\[${form.index}\\](?:\\.|\\[|$)`),
			{
				severity: ["error", "fatal"],
			},
		).length > 0 || data.invalid;
	const hasBody = form.items.length > 0 || Boolean(form.message);
	// Ports can change while the card keeps its size; re-measure them then.
	const updateNodeInternals = useUpdateNodeInternals();
	const ports = form.items.map((item) => item.anchor).join(" ");
	// biome-ignore lint/correctness/useExhaustiveDependencies: ports trigger the re-measure
	useEffect(() => {
		updateNodeInternals(id);
	}, [id, ports, updateNodeInternals]);
	return (
		<article
			data-test-id="plan-definition-graph__form-node"
			data-action-index={form.index}
			data-action-key={form.key}
			aria-label={`Form ${form.index + 1}: ${title}`}
			aria-current={selected ? "step" : undefined}
			className={cn(
				// The card itself is the gray heading color and only the body paints white:
				// at fractional zoom an inner edge then bleeds gray next to the gray border.
				"relative overflow-hidden rounded-lg border border-border-primary bg-bg-secondary bg-clip-padding shadow-sm transition-colors",
				!selected &&
					!invalid &&
					!disabled &&
					"hover:border-border-primary_hover",
				selected &&
					"border-border-brand outline-2 -outline-offset-1 outline-border-brand",
				invalid && "border-border-error",
				dragging && "shadow-lg",
				// The card shows focus for its main button, outside the border.
				"has-[>button:focus-visible]:ring-4 has-[>button:focus-visible]:ring-ring-blue",
			)}
			style={{ width: GRAPH_CARD_WIDTH, height: form.height }}
		>
			<button
				type="button"
				className={cn(
					"block h-full w-full touch-none select-none text-left text-text-primary outline-none",
					disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
					dragging && "cursor-grabbing",
				)}
				aria-label={`${title}${invalid ? ", Form has errors" : ""}`}
				aria-description={
					disabled
						? conditional
							? "Conditional form"
							: undefined
						: `${conditional ? "Conditional form. " : ""}Drag or press Alt+Arrow Up and Alt+Arrow Down to reorder.`
				}
				aria-current={selected ? "step" : undefined}
				data-test-id="plan-definition-graph__form-button"
				disabled={disabled}
				onClick={() => {
					if (!sorting) onSelect();
				}}
				onKeyDown={(event) => {
					if (
						!event.altKey ||
						(event.key !== "ArrowUp" && event.key !== "ArrowDown")
					)
						return;
					event.preventDefault();
					event.stopPropagation();
					onMove(event.key === "ArrowUp" ? -1 : 1);
				}}
			>
				<span
					className={cn(
						"relative flex items-center gap-2 pl-4 pr-20",
						hasBody && "border-b border-border-secondary",
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
					<RulePorts anchor={form.anchor} />
				</span>
				{hasBody && (
					<span className="block bg-bg-primary p-4">
						{form.message && (
							<output className="block h-8 text-xs text-text-secondary">
								{form.message}
							</output>
						)}
						<span className="block space-y-2">
							{form.items.map((item) => (
								<span
									key={item.anchor}
									data-test-id="plan-definition-graph__item-node"
									data-link-id={item.linkId}
									className="relative flex items-center gap-2 rounded border border-border-primary bg-bg-secondary px-3"
									style={{ height: item.height }}
								>
									<span
										className="min-w-0 flex-1 truncate text-xs text-text-primary"
										title={item.label}
									>
										{item.label}
									</span>
									<RulePorts anchor={item.anchor} />
								</span>
							))}
						</span>
					</span>
				)}
			</button>
			<div
				className="nodrag nopan absolute right-2 flex -translate-y-1/2 gap-1"
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
		</article>
	);
}
