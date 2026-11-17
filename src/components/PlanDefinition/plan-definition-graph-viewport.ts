import { select } from "d3-selection";
import {
	type D3ZoomEvent,
	type ZoomBehavior,
	type ZoomTransform,
	zoom,
	zoomIdentity,
	zoomTransform,
} from "d3-zoom";
import {
	type KeyboardEvent,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { GraphEdgeVisibility } from "./plan-definition-graph-state";
import {
	GRAPH_MAX_ZOOM,
	GRAPH_MIN_ZOOM,
	type GraphViewportState,
} from "./plan-definition-graph-state";

export const GRAPH_INTERACTIVE =
	'[data-action-key], button, [role="button"], [role="menu"], [data-graph-controls]';

type GraphNodeBounds = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

/** Recover only offscreen axes, keeping the user's zoom and visible area. */
function revealGraphTransform(
	transform: ZoomTransform,
	bounds: GraphNodeBounds,
	viewportWidth: number,
	viewportHeight: number,
) {
	const offscreenX =
		transform.applyX(bounds.right) < 32 ||
		transform.applyX(bounds.left) > viewportWidth - 32;
	const offscreenY =
		transform.applyY(bounds.bottom) < 48 ||
		transform.applyY(bounds.top) > viewportHeight - 64;
	if (!offscreenX && !offscreenY) return transform;
	return zoomIdentity
		.translate(
			offscreenX
				? viewportWidth / 2 - ((bounds.left + bounds.right) / 2) * transform.k
				: transform.x,
			offscreenY
				? viewportHeight / 2 - ((bounds.top + bounds.bottom) / 2) * transform.k
				: transform.y,
		)
		.scale(transform.k);
}

/** Leave room for the fixed viewport controls when fitting the whole PlanDefinition. */
export function fitGraphTransform(
	width: number,
	height: number,
	viewportWidth: number,
	viewportHeight: number,
) {
	const availableWidth = Math.max(1, viewportWidth - 64);
	const availableHeight = Math.max(1, viewportHeight - 112);
	const scale = Math.max(
		GRAPH_MIN_ZOOM,
		Math.min(1, availableWidth / width, availableHeight / height),
	);
	return zoomIdentity
		.translate(
			(viewportWidth - width * scale) / 2,
			48 + (availableHeight - height * scale) / 2,
		)
		.scale(scale);
}

/** A viewport around the ordered graph, independent of form dragging and rules. */
export function useGraphViewport({
	width,
	height,
	nodeBounds,
	visibleEdges,
	enabled,
	sorting,
	savedViewport,
	onViewportChange,
}: {
	width: number;
	height: number;
	nodeBounds: GraphNodeBounds;
	visibleEdges: GraphEdgeVisibility;
	enabled: boolean;
	sorting: boolean;
	savedViewport?: GraphViewportState;
	onViewportChange: (viewport: GraphViewportState) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const behaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown>>(null);
	const sizeRef = useRef<{ width: number; contentWidth: number }>(null);
	const fitted = useRef(false);
	const previousVisibleEdges = useRef(visibleEdges);
	const [transform, setTransform] = useState(() => ({
		x: savedViewport?.x ?? 0,
		y: savedViewport?.y ?? 0,
		k: savedViewport?.k ?? 1,
	}));
	const [panning, setPanning] = useState(false);

	const restore = useEffectEvent(() => {
		const element = ref.current;
		const behavior = behaviorRef.current;
		if (!element || !behavior || !savedViewport) return;
		const { x, y, k, viewportWidth, contentWidth } = savedViewport;
		sizeRef.current = { width: viewportWidth, contentWidth };
		select(element).call(
			behavior.transform,
			zoomIdentity.translate(x, y).scale(k),
		);
	});

	const remember = useEffectEvent(
		(event: D3ZoomEvent<HTMLDivElement, unknown>) => {
			setPanning(false);
			const bounds = ref.current?.getBoundingClientRect();
			if (!bounds?.width || !bounds.height) return;
			const { x, y, k } = event.transform;
			onViewportChange({
				x,
				y,
				k,
				viewportWidth: bounds.width,
				contentWidth: width,
			});
		},
	);

	const filter = useEffectEvent(
		(event: MouseEvent | TouchEvent | WheelEvent) => {
			if (sorting || !(event.target instanceof Element)) return false;
			if (event.target.closest("[data-graph-controls]")) return false;
			if (event.type === "wheel") return true;
			if (event.ctrlKey) return false;
			if ("button" in event && event.button === 1) return true;
			if ("button" in event && event.button !== 0) return false;
			return !event.target.closest(GRAPH_INTERACTIVE);
		},
	);

	const synchronize = useEffectEvent((edges = visibleEdges) => {
		const element = ref.current;
		const behavior = behaviorRef.current;
		if (!element || !behavior) return;
		const { width: viewportWidth, height: viewportHeight } =
			element.getBoundingClientRect();
		if (!viewportWidth || !viewportHeight) return;
		const previous = sizeRef.current;
		const current = zoomTransform(element);
		let next = fitted.current
			? fitGraphTransform(width, height, viewportWidth, viewportHeight)
			: zoomIdentity
					.translate(
						previous
							? current.x +
									(viewportWidth -
										previous.width -
										(width - previous.contentWidth) * current.k) /
										2
							: (viewportWidth - width) / 2,
						previous ? current.y : 0,
					)
					.scale(current.k);
		const filtersChanged =
			previousVisibleEdges.current.condition !== edges.condition ||
			previousVisibleEdges.current.prefill !== edges.prefill;
		previousVisibleEdges.current = edges;
		if (filtersChanged && !fitted.current) {
			// Hidden item rows can move the entire form track outside a panned view.
			next = revealGraphTransform(
				next,
				nodeBounds,
				viewportWidth,
				viewportHeight,
			);
		}
		sizeRef.current = { width: viewportWidth, contentWidth: width };
		select(element).call(behavior.transform, next);
	});

	useLayoutEffect(() => {
		const element = ref.current;
		if (!enabled || !element) return;
		const behavior = zoom<HTMLDivElement, unknown>()
			.scaleExtent([GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM])
			.clickDistance(5)
			.duration(0)
			.touchable(true)
			.extent((): [[number, number], [number, number]] => {
				const bounds = element.getBoundingClientRect();
				return [
					[0, 0],
					[bounds.width, bounds.height],
				];
			})
			.filter(filter)
			.on("start", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
				const type = event.sourceEvent?.type;
				if (type === "mousedown" || type === "touchstart") setPanning(true);
			})
			.on("zoom", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
				if (event.sourceEvent) fitted.current = false;
				const { x, y, k } = event.transform;
				setTransform({ x, y, k });
			})
			// Persist at the end of a gesture, not on every pointer movement.
			.on("end", (event: D3ZoomEvent<HTMLDivElement, unknown>) =>
				remember(event),
			);
		behaviorRef.current = behavior;
		const selection = select(element).call(behavior);
		restore();
		synchronize();
		const observer = new ResizeObserver(() => synchronize());
		observer.observe(element);
		return () => {
			observer.disconnect();
			selection.on(".zoom", null);
			behaviorRef.current = null;
			sizeRef.current = null;
		};
	}, [enabled]);

	useLayoutEffect(() => {
		if (enabled && width > 0 && height > 0) synchronize(visibleEdges);
	}, [enabled, width, height, visibleEdges]);

	const zoomTo = (scale: number) => {
		const element = ref.current;
		const behavior = behaviorRef.current;
		if (!element || !behavior || sorting) return;
		fitted.current = false;
		select(element).call(behavior.scaleTo, scale);
	};
	const fitView = () => {
		if (sorting) return;
		const element = ref.current;
		const behavior = behaviorRef.current;
		if (!element || !behavior) return;
		const bounds = element.getBoundingClientRect();
		fitted.current = true;
		select(element).call(
			behavior.transform,
			fitGraphTransform(width, height, bounds.width, bounds.height),
		);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (
			event.target !== event.currentTarget ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey ||
			sorting
		)
			return;
		const element = ref.current;
		const behavior = behaviorRef.current;
		if (!element || !behavior) return;
		const pan: Record<string, [number, number]> = {
			ArrowLeft: [40, 0],
			ArrowRight: [-40, 0],
			ArrowUp: [0, 40],
			ArrowDown: [0, -40],
		};
		const movement = pan[event.key];
		if (movement) {
			fitted.current = false;
			const [x, y] = movement;
			select(element).call(
				behavior.translateBy,
				x / transform.k,
				y / transform.k,
			);
		} else if (event.key === "+" || event.key === "=")
			zoomTo(transform.k * 1.2);
		else if (event.key === "-") zoomTo(transform.k / 1.2);
		else if (event.key === "0") zoomTo(1);
		else if (event.key.toLowerCase() === "f") fitView();
		else return;
		event.preventDefault();
	};
	return { ref, transform, panning, zoomTo, fitView, onKeyDown };
}
