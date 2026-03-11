import { useCallback, useEffect, useRef } from "react";
import { useChatDispatch, useChatState } from "./chat-context";
import type { ElementContext } from "./types";

const CHAT_WIDGET_ID = "claude-chat-widget";

type Fiber = Record<string, unknown> & {
	type: unknown;
	return: Fiber | null;
	memoizedProps: Record<string, unknown> | null;
};

function getFiber(element: Element): Fiber | null {
	for (const key of Object.keys(element)) {
		if (key.startsWith("__reactFiber$")) {
			return (element as unknown as Record<string, Fiber>)[key] ?? null;
		}
	}
	return null;
}

function getFiberName(fiber: Fiber): string | null {
	const type = fiber.type;
	if (
		type != null &&
		(typeof type === "function" || typeof type === "object")
	) {
		const fn = type as Record<string, unknown>;
		const name = (fn.displayName as string) ?? (fn.name as string);
		if (name && name !== "div" && name !== "span") return name;
	}
	return null;
}

function getReactComponentName(element: Element): string {
	let fiber = getFiber(element);
	while (fiber) {
		const name = getFiberName(fiber);
		if (name) return name;
		fiber = fiber.return;
	}
	return "unknown";
}

function getReactComponentHierarchy(element: Element): string[] {
	const hierarchy: string[] = [];
	let fiber = getFiber(element);
	while (fiber) {
		const name = getFiberName(fiber);
		if (name) hierarchy.push(name);
		fiber = fiber.return;
	}
	return hierarchy;
}

function getReactProps(element: Element): Record<string, unknown> {
	let fiber = getFiber(element);
	while (fiber) {
		const props = fiber.memoizedProps;
		if (getFiberName(fiber) && props != null && typeof props === "object") {
			const safe: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(props)) {
				if (k === "children") continue;
				const t = typeof v;
				if (t === "string" || t === "number" || t === "boolean" || v === null) {
					safe[k] = v;
				}
			}
			return safe;
		}
		fiber = fiber.return;
	}
	return {};
}

function buildSelector(element: Element): string {
	const parts: string[] = [];
	let current: Element | null = element;
	while (current && current !== document.body) {
		let selector = current.tagName.toLowerCase();
		if (current.id) {
			parts.unshift(`#${current.id}`);
			break;
		}
		const classes = Array.from(current.classList).slice(0, 2).join(".");
		if (classes) selector += `.${classes}`;
		const parent: Element | null = current.parentElement;
		if (parent) {
			const tag = current.tagName;
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === tag,
			);
			if (siblings.length > 1) {
				const idx = siblings.indexOf(current) + 1;
				selector += `:nth-of-type(${idx})`;
			}
		}
		parts.unshift(selector);
		current = parent;
	}
	return parts.join(" > ");
}

function getComputedStyleSubset(element: Element): Record<string, string> {
	const cs = window.getComputedStyle(element);
	const keys = [
		"color",
		"backgroundColor",
		"fontSize",
		"fontWeight",
		"padding",
		"margin",
		"display",
		"position",
		"opacity",
		"gap",
	];
	const result: Record<string, string> = {};
	for (const k of keys) {
		const v = cs.getPropertyValue(
			k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
		);
		if (v && v !== "normal" && v !== "none" && v !== "0px" && v !== "static") {
			result[k] = v;
		}
	}
	return result;
}

function findNearestLandmark(element: Element): string {
	let current: Element | null = element;
	while (current && current !== document.body) {
		const role = current.getAttribute("role");
		if (
			role &&
			["main", "navigation", "banner", "dialog", "region", "form"].includes(
				role,
			)
		) {
			const label = current.getAttribute("aria-label") ?? role;
			return `${role}${label !== role ? `: ${label}` : ""}`;
		}
		const tag = current.tagName.toLowerCase();
		if (["main", "nav", "header", "footer", "aside", "dialog"].includes(tag)) {
			const label = current.getAttribute("aria-label") ?? "";
			return `${tag}${label ? `: ${label}` : ""}`;
		}
		if (current.id) {
			return `#${current.id}`;
		}
		current = current.parentElement;
	}
	return "body";
}

function extractElementContext(element: Element): ElementContext {
	const rect = element.getBoundingClientRect();
	const attrs: Record<string, string> = {};
	for (const attr of element.attributes) {
		if (
			attr.name.startsWith("data-") ||
			attr.name === "role" ||
			attr.name === "aria-label" ||
			attr.name === "class" ||
			attr.name === "href" ||
			attr.name === "type" ||
			attr.name === "name" ||
			attr.name === "placeholder"
		) {
			attrs[attr.name] = attr.value;
		}
	}
	return {
		selector: buildSelector(element),
		componentName: getReactComponentName(element),
		componentHierarchy: getReactComponentHierarchy(element),
		textContent: (element.textContent ?? "").trim().slice(0, 200),
		tagName: element.tagName.toLowerCase(),
		rect: {
			top: rect.top,
			left: rect.left,
			width: rect.width,
			height: rect.height,
		},
		attributes: attrs,
		pageUrl: window.location.href,
		routePath: window.location.pathname,
		props: getReactProps(element),
		computedStyles: getComputedStyleSubset(element),
		nearestLandmark: findNearestLandmark(element),
	};
}

function getElementUnderOverlay(
	x: number,
	y: number,
	overlayRef: React.RefObject<HTMLDivElement | null>,
	highlightRef: React.RefObject<HTMLDivElement | null>,
): Element | null {
	const overlay = overlayRef.current;
	const highlight = highlightRef.current;
	if (overlay) overlay.style.display = "none";
	if (highlight) highlight.style.display = "none";
	const el = document.elementFromPoint(x, y);
	if (overlay) overlay.style.display = "";
	if (highlight) highlight.style.display = "";
	return el;
}

export function ElementPicker() {
	const { pickerActive } = useChatState();
	const dispatch = useChatDispatch();
	const highlightRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);

	const handleMouseMove = useCallback((e: MouseEvent) => {
		const el = getElementUnderOverlay(
			e.clientX,
			e.clientY,
			overlayRef,
			highlightRef,
		);
		if (!el || el.closest(`#${CHAT_WIDGET_ID}`)) {
			if (highlightRef.current) highlightRef.current.style.display = "none";
			return;
		}
		const rect = el.getBoundingClientRect();
		if (highlightRef.current) {
			const h = highlightRef.current;
			h.style.display = "block";
			h.style.top = `${rect.top}px`;
			h.style.left = `${rect.left}px`;
			h.style.width = `${rect.width}px`;
			h.style.height = `${rect.height}px`;
		}
	}, []);

	const handleClick = useCallback(
		(e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const el = getElementUnderOverlay(
				e.clientX,
				e.clientY,
				overlayRef,
				highlightRef,
			);
			if (!el || el.closest(`#${CHAT_WIDGET_ID}`)) return;
			try {
				const context = extractElementContext(el);
				dispatch({ type: "set_element_context", context });
			} catch (err) {
				console.error("[element-picker] extraction failed:", err);
			}
			dispatch({ type: "set_picker", active: false });
		},
		[dispatch],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				dispatch({ type: "set_picker", active: false });
			}
		},
		[dispatch],
	);

	useEffect(() => {
		if (!pickerActive) return;
		document.addEventListener("mousemove", handleMouseMove, true);
		document.addEventListener("click", handleClick, true);
		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove, true);
			document.removeEventListener("click", handleClick, true);
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [pickerActive, handleMouseMove, handleClick, handleKeyDown]);

	if (!pickerActive) return null;

	return (
		<div
			ref={overlayRef}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				cursor: "crosshair",
				pointerEvents: "auto",
			}}
		>
			<div
				ref={highlightRef}
				style={{
					position: "fixed",
					display: "none",
					border: "2px solid #3b82f6",
					backgroundColor: "rgba(59, 130, 246, 0.1)",
					borderRadius: "2px",
					pointerEvents: "none",
					transition: "all 0.05s ease-out",
				}}
			/>
		</div>
	);
}
