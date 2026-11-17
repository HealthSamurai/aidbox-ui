import { Button, cn, IconButton } from "@health-samurai/react-components";
import { Minus, Plus, Scan } from "lucide-react";
import type { GraphEdgeVisibility } from "./plan-definition-graph-state";
import { GRAPH_MAX_ZOOM, GRAPH_MIN_ZOOM } from "./plan-definition-graph-state";

export function GraphEdgeControls({
	visible,
	onChange,
}: {
	visible: GraphEdgeVisibility;
	onChange: (visible: GraphEdgeVisibility) => void;
}) {
	return (
		<fieldset
			aria-label="Visible connections"
			data-graph-controls
			className="absolute right-3 top-3 z-40 flex flex-col gap-0.5 rounded-md border border-border-primary bg-bg-primary p-1.5 shadow-sm"
		>
			{(
				[
					["condition", "Enable when"],
					["prefill", "Prefill"],
				] as const
			).map(([kind, label]) => (
				<Button
					key={kind}
					variant="ghost"
					size="small"
					aria-pressed={visible[kind]}
					title={`${visible[kind] ? "Hide" : "Show"} ${label.toLowerCase()} edges`}
					className={cn(
						"h-7 justify-start gap-2 rounded px-2 text-xs font-normal text-text-primary",
						!visible[kind] && "opacity-50",
					)}
					onClick={() => onChange({ ...visible, [kind]: !visible[kind] })}
					data-test-id={`plan-definition-graph__${kind}-visibility-button`}
				>
					<svg
						width="36"
						height="12"
						viewBox="0 0 36 12"
						aria-hidden="true"
						className="size-9 h-3 shrink-0 text-text-disabled"
					>
						<path
							d="M4 6H31"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeDasharray={kind === "prefill" ? "5 4" : undefined}
						/>
						<circle cx="4" cy="6" r="2.5" fill="currentColor" />
						<path d="M30 2L35 6L30 10Z" fill="currentColor" />
					</svg>
					<span className={cn(!visible[kind] && "line-through")}>{label}</span>
				</Button>
			))}
		</fieldset>
	);
}

export function GraphZoomControls({
	scale,
	disabled,
	onZoom,
	onFit,
}: {
	scale: number;
	disabled: boolean;
	onZoom: (scale: number) => void;
	onFit: () => void;
}) {
	return (
		<fieldset
			aria-label="Graph view controls"
			data-graph-controls
			className="absolute bottom-3 left-3 z-40 flex items-center divide-x divide-border-secondary overflow-hidden rounded-md border border-border-primary bg-bg-primary shadow-sm"
		>
			<IconButton
				className="size-8 rounded-none"
				aria-label="Zoom out"
				title="Zoom out (−)"
				icon={<Minus />}
				disabled={disabled || scale <= GRAPH_MIN_ZOOM}
				onClick={() => onZoom(scale / 1.2)}
				data-test-id="plan-definition-graph__zoom-out-button"
			/>
			<Button
				variant="ghost"
				size="small"
				className="h-8 min-w-16 rounded-none px-2 text-xs tabular-nums"
				aria-label={`Reset zoom to 100%, current zoom ${Math.round(scale * 100)}%`}
				title="Reset zoom to 100% (0)"
				disabled={disabled}
				onClick={() => onZoom(1)}
				data-test-id="plan-definition-graph__reset-zoom-button"
			>
				{Math.round(scale * 100)}%
			</Button>
			<IconButton
				className="size-8 rounded-none"
				aria-label="Zoom in"
				title="Zoom in (+)"
				icon={<Plus />}
				disabled={disabled || scale >= GRAPH_MAX_ZOOM}
				onClick={() => onZoom(scale * 1.2)}
				data-test-id="plan-definition-graph__zoom-in-button"
			/>
			<IconButton
				className="size-8 rounded-none"
				aria-label="Fit view"
				title="Fit view (F)"
				icon={<Scan />}
				disabled={disabled}
				onClick={onFit}
				data-test-id="plan-definition-graph__fit-view-button"
			/>
		</fieldset>
	);
}
