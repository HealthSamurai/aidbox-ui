import { Button, cn } from "@health-samurai/react-components";
import type { GraphEdgeVisibility } from "./plan-definition-graph-state";

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
			className="flex flex-col gap-0.5 rounded-md border border-border-primary bg-bg-primary p-1.5 shadow-sm"
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
						"justify-start gap-2 font-normal text-text-primary",
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
