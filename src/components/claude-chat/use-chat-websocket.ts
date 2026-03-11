import { useEffect } from "react";
import { useChatDispatch } from "./chat-context";
import type { ElementContext, ServerMessage } from "./types";

export function useChatWebSocket() {
	const dispatch = useChatDispatch();

	useEffect(() => {
		if (!import.meta.hot) return;

		const handler = (msg: ServerMessage) => {
			switch (msg.type) {
				case "status":
					dispatch({ type: "set_status", status: msg.status });
					break;
				case "chunk":
					dispatch({ type: "append_chunk", id: msg.id, text: msg.text });
					break;
				case "tool_use":
					dispatch({ type: "set_tool_use", id: msg.id, tool: msg.tool });
					break;
				case "done":
					dispatch({ type: "mark_done", id: msg.id });
					break;
				case "error":
					dispatch({ type: "set_error", id: msg.id, error: msg.error });
					break;
			}
		};

		import.meta.hot.on("claude-chat:event", handler);
		import.meta.hot.send("claude-chat:init", {});

		return () => {
			import.meta.hot?.off("claude-chat:event", handler);
		};
	}, [dispatch]);

	function sendMessage(id: string, content: string, context?: ElementContext) {
		import.meta.hot?.send("claude-chat:send", {
			type: "send_message",
			id,
			content,
			context,
		});
	}

	function abort(id: string) {
		import.meta.hot?.send("claude-chat:send", { type: "abort", id });
	}

	return { sendMessage, abort };
}
