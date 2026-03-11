import { useEffect } from "react";
import { useChatState } from "./chat-context";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { ElementPicker } from "./element-picker";
import type { ElementContext } from "./types";
import { useChatWebSocket } from "./use-chat-websocket";

const PANEL_WIDTH = "24rem";

function ChatPanel({
	onSend,
}: {
	onSend: (id: string, content: string, context?: ElementContext) => void;
}) {
	useEffect(() => {
		const root = document.getElementById("root");
		if (root) root.style.marginRight = PANEL_WIDTH;
		return () => {
			if (root) root.style.marginRight = "";
		};
	}, []);

	return (
		<div
			className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-bg-primary border-l border-border-primary"
			style={{ width: PANEL_WIDTH }}
		>
			<ChatHeader />
			<ChatMessages />
			<ChatInput onSend={onSend} />
		</div>
	);
}

export default function ClaudeChatWidget() {
	const { isOpen } = useChatState();
	const { sendMessage } = useChatWebSocket();

	return (
		<div id="claude-chat-widget">
			{isOpen && <ChatPanel onSend={sendMessage} />}
			<ElementPicker />
		</div>
	);
}
