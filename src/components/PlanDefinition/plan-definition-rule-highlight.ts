import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	layer,
	RectangleMarker,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import {
	type ConditionGroup,
	type ConditionNode,
	isConditionComplete,
} from "./plan-definition-conditions";
import {
	type ExpressionRange,
	planDefinitionExpressionSourceRanges,
} from "./plan-definition-expressions";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";
import type { PlanDefinitionActionDraft } from "./plan-definition-model";
import "./plan-definition-rule-highlight.css";

const showRanges = StateEffect.define<ExpressionRange[]>();
const rangeHighlights = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		for (const effect of transaction.effects)
			if (effect.is(showRanges))
				return Decoration.set(
					effect.value.map(({ from, to }) =>
						Decoration.mark({
							class: "plan-definition-rule-expression-highlight",
						}).range(from, to),
					),
					true,
				);
		return transaction.docChanged ? Decoration.none : value;
	},
	provide: (field) => [
		EditorView.decorations.from(field),
		layer({
			above: true,
			class: "plan-definition-rule-expression-overlay",
			update: (update) =>
				update.startState.field(field, false) !==
				update.state.field(field, false),
			markers(view) {
				const markers: RectangleMarker[] = [];
				view.state
					.field(field)
					.between(0, view.state.doc.length, (from, to) => {
						markers.push(
							...RectangleMarker.forRange(
								view,
								"plan-definition-rule-highlight-box",
								EditorSelection.range(from, to),
							),
						);
					});
				return markers;
			},
		}),
	],
});

/** Map visual leaf rows back to the resource condition that produced them. */
export function conditionRulePaths(
	rules: ConditionGroup,
	conditions: NonNullable<PlanDefinitionActionDraft["condition"]>,
	actionPath: string,
) {
	const paths: Record<string, string> = {};
	const assign = (node: ConditionNode, path: string) => {
		if (node.kind === "group")
			for (const child of node.children) assign(child, path);
		else if (node.kind !== "placeholder" && isConditionComplete(node))
			paths[node.id] = path;
	};
	conditions.forEach((condition, index) => {
		const node = conditions.length === 1 ? rules : rules.children[index];
		if (node) assign(node, `${actionPath}.condition.${condition.id ?? index}`);
	});
	return paths;
}

function blink(elements: HTMLElement[], pseudoElement?: string) {
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	return elements.flatMap((element) => {
		const animation = element.animate?.(
			reducedMotion
				? [{ opacity: 0.28 }, { opacity: 0.28 }]
				: [
						{ opacity: 0, offset: 0 },
						{ opacity: 0.28, offset: 0.25 },
						{ opacity: 0.28, offset: 0.65 },
						{ opacity: 0, offset: 1 },
					],
			{
				pseudoElement,
				duration: reducedMotion ? 1200 : 600,
				iterations: reducedMotion ? 1 : 2,
				easing: "ease-in-out",
			},
		);
		return animation ? [animation] : [];
	});
}

function revealRule(
	root: HTMLElement,
	edge: PlanDefinitionGraphEdge,
	sourceActionId: string,
) {
	const rows: HTMLElement[] = [];
	const editors: EditorView[] = [];
	for (const row of root.querySelectorAll<HTMLElement>("[data-rule-path]")) {
		if (row.dataset.rulePath !== edge.path) continue;
		const editor = row.querySelector<HTMLElement>(".cm-editor");
		const view = editor && EditorView.findFromDOM(editor);
		if (view) {
			const ranges = planDefinitionExpressionSourceRanges(
				view.state.doc.toString(),
				sourceActionId,
				edge.sourceLinkId,
			);
			const first = ranges[0];
			if (!first) continue;
			view.dispatch({
				effects: [
					...(view.state.field(rangeHighlights, false)
						? []
						: [StateEffect.appendConfig.of(rangeHighlights)]),
					showRanges.of(ranges),
					EditorView.scrollIntoView(first.from, { y: "nearest" }),
				],
			});
			editors.push(view);
		} else {
			if (
				edge.kind === "condition" &&
				(row.dataset.sourceActionId !== sourceActionId ||
					row.dataset.sourceLinkId !== edge.sourceLinkId)
			)
				continue;
			rows.push(row);
		}
		if (rows.length + editors.length === 1)
			row.scrollIntoView({ block: "nearest", inline: "nearest" });
	}
	return { rows, editors };
}

/** Reveal the rule without stealing focus, and cancel the previous flash on another selection. */
export function usePlanDefinitionRuleHighlight(
	edge: PlanDefinitionGraphEdge | null,
	actions: PlanDefinitionActionDraft[],
) {
	const ref = useRef<HTMLElement>(null);
	const sourceActionId = edge ? actions[edge.sourceIndex]?.id : undefined;
	useEffect(() => {
		if (!edge || !sourceActionId) return;
		const animations: Animation[] = [];
		let editors: EditorView[] = [];
		const clear = () => {
			for (const animation of animations) animation.cancel();
			for (const view of editors)
				if (view.dom.isConnected) view.dispatch({ effects: showRanges.of([]) });
		};
		let timeout: ReturnType<typeof setTimeout>;
		let frame = requestAnimationFrame(() => {
			if (!ref.current) return;
			const targets = revealRule(ref.current, edge, sourceActionId);
			editors = targets.editors;
			// Let CodeMirror render the marked ranges after scrolling them into view.
			frame = requestAnimationFrame(() => {
				const overlays = editors.flatMap((view) => [
					...view.dom.querySelectorAll<HTMLElement>(
						".plan-definition-rule-expression-overlay",
					),
				]);
				animations.push(...blink(targets.rows, "::after"), ...blink(overlays));
				timeout = setTimeout(clear, 1200);
			});
		});
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timeout);
			clear();
		};
	}, [edge, sourceActionId]);
	return ref;
}
