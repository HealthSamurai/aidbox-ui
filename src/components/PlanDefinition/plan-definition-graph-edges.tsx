import { useOperationOutcomeIssues } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import type { EdgeProps } from "@xyflow/react";
import { type GraphForm, graphEdgePath } from "./plan-definition-graph-layout";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";
import type { RuleEdge } from "./plan-definition-graph-types";

export function ruleLabel(
	edge: PlanDefinitionGraphEdge,
	forms: GraphForm[],
	title: (index: number) => string,
) {
	const kind = edge.kind === "condition" ? "Enable when" : "Prefill";
	const sourceItem =
		forms[edge.sourceIndex]?.items.find(
			(item) => item.linkId === edge.sourceLinkId,
		)?.label ?? "Form answers";
	const targetItem =
		forms[edge.targetIndex]?.items.find(
			(item) => item.linkId === edge.targetLinkId,
		)?.label ?? edge.targetLinkId;
	const destination =
		edge.targetLinkId === undefined
			? title(edge.targetIndex)
			: `${title(edge.targetIndex)}, ${targetItem}`;
	return `${kind}: ${title(edge.sourceIndex)}, ${sourceItem}, to ${destination}. Edit rule`;
}

/** Orthogonal rule edge routed through its layout lane, outside the form column. */
function GraphRuleEdge({
	sourceX,
	sourceY,
	targetX,
	targetY,
	data,
}: EdgeProps<RuleEdge>) {
	const issues = useOperationOutcomeIssues(
		data?.route.edge.issuePattern ?? /$^/,
		{ severity: ["error", "fatal"] },
	);
	if (!data) return null;
	const { route, label, highlighted, invalid, interactive } = data;
	const { edge } = route;
	const source = { x: sourceX, y: sourceY + route.sourceOffset };
	const target = { x: targetX, y: targetY + route.targetOffset };
	const direction = route.side === "left" ? 1 : -1;
	const path = graphEdgePath(
		source,
		{ x: target.x - direction * 4, y: target.y },
		route.laneX,
	);
	const kind = invalid || issues.length ? "error" : edge.kind;
	return (
		<g
			data-test-id="plan-definition-graph__edge"
			data-edge-kind={edge.kind}
			data-highlighted={highlighted}
			className={
				!highlighted
					? "text-text-disabled"
					: kind === "condition"
						? "text-text-brand-primary"
						: kind === "prefill"
							? "text-text-success-primary"
							: "text-text-error-primary"
			}
		>
			<path
				d={path}
				fill="none"
				stroke="currentColor"
				className="[stroke-width:1.5px] group-hover:[stroke-width:3px] group-focus-visible:[stroke-width:3px]"
				strokeDasharray={edge.kind === "prefill" ? "5 4" : undefined}
				data-test-id="plan-definition-graph__edge-path"
			/>
			{/* A wide transparent stroke, so the thin line is easy to hit. */}
			<path
				d={path}
				fill="none"
				stroke="transparent"
				strokeWidth="14"
				className={
					interactive
						? "pointer-events-auto cursor-pointer"
						: "pointer-events-none"
				}
				data-test-id="plan-definition-graph__edge-hit-area"
			>
				<title>{label}</title>
			</path>
			<circle
				cx={source.x}
				cy={source.y}
				r="3.5"
				fill="currentColor"
				stroke="var(--color-bg-primary)"
				strokeWidth="1.5"
				data-test-id="plan-definition-graph__source-port"
				data-side={route.side}
				data-anchor={route.sourceAnchor}
			/>
			<polygon
				points="-4,-4 4,0 -4,4"
				transform={`translate(${target.x} ${target.y}) scale(${direction} 1)`}
				fill="currentColor"
				data-test-id="plan-definition-graph__target-port"
				data-side={route.side}
				data-anchor={route.targetAnchor}
			/>
		</g>
	);
}

/** Module-level so React Flow does not remount edges on every render. */
export const graphEdgeTypes = { rule: GraphRuleEdge };
