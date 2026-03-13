export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type ElementContext = {
	selector: string;
	componentName: string;
	componentHierarchy: string[];
	textContent: string;
	tagName: string;
	rect: { top: number; left: number; width: number; height: number };
	attributes: Record<string, string>;
	pageUrl: string;
	routePath: string;
	props: Record<string, unknown>;
	computedStyles: Record<string, string>;
	nearestLandmark: string;
};

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	toolName?: string;
	elementContexts?: ElementContext[];
	isStreaming?: boolean;
};

export function formatElementContexts(contexts: ElementContext[]): string {
	return contexts
		.map((ctx, i) => {
			const lines = [
				`[UI Element ${String(i + 1)} of ${String(contexts.length)}]`,
				`Page: ${ctx.pageUrl}`,
				`Route: ${ctx.routePath}`,
				`Tag: <${ctx.tagName}>`,
				`Component: ${ctx.componentName}`,
				`Component hierarchy: ${ctx.componentHierarchy.join(" → ") || "unknown"}`,
				`Selector: ${ctx.selector}`,
				`Nearest landmark: ${ctx.nearestLandmark}`,
				`Text: "${ctx.textContent}"`,
				`Attributes: ${JSON.stringify(ctx.attributes)}`,
				`Position: top=${String(Math.round(ctx.rect.top))} left=${String(Math.round(ctx.rect.left))} size=${String(Math.round(ctx.rect.width))}×${String(Math.round(ctx.rect.height))}`,
			];
			if (Object.keys(ctx.props).length > 0) {
				lines.push(`Props: ${JSON.stringify(ctx.props)}`);
			}
			if (Object.keys(ctx.computedStyles).length > 0) {
				lines.push(`Computed styles: ${JSON.stringify(ctx.computedStyles)}`);
			}
			return lines.join("\n");
		})
		.join("\n\n");
}

// Browser → Vite Plugin
export type ClientMessage =
	| {
			type: "send_message";
			id: string;
			content: string;
			contexts?: ElementContext[];
	  }
	| { type: "abort"; id: string };

// Vite Plugin → Browser
export type ServerMessage =
	| { type: "chunk"; id: string; text: string }
	| { type: "tool_use"; id: string; tool: string }
	| { type: "done"; id: string }
	| { type: "error"; id: string; error: string }
	| { type: "status"; status: ConnectionStatus };
