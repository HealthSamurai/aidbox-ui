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
	elementContext?: ElementContext;
	isStreaming?: boolean;
};

// Browser → Vite Plugin
export type ClientMessage =
	| {
			type: "send_message";
			id: string;
			content: string;
			context?: ElementContext;
	  }
	| { type: "abort"; id: string };

// Vite Plugin → Browser
export type ServerMessage =
	| { type: "chunk"; id: string; text: string }
	| { type: "tool_use"; id: string; tool: string }
	| { type: "done"; id: string }
	| { type: "error"; id: string; error: string }
	| { type: "status"; status: ConnectionStatus };
