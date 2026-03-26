import { useCallback, useEffect, useRef, useState } from "react";
import { useChatState } from "./chat-context";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { ElementPicker } from "./element-picker";
import type { ElementContext } from "./types";
import { useChatWebSocket } from "./use-chat-websocket";

const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 200;
const MAX_WIDTH = 800;
const STORAGE_KEY = "claude-chat-panel-width";

function getStoredWidth(): number {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(v)));
	} catch {}
	return DEFAULT_WIDTH;
}

function ChatPanel({
	onSend,
}: {
	onSend: (id: string, content: string, contexts?: ElementContext[]) => void;
}) {
	const [width, setWidth] = useState(getStoredWidth);
	const isDragging = useRef(false);

	useEffect(() => {
		const root = document.getElementById("root");
		if (root) root.style.marginRight = `${String(width)}px`;
		return () => {
			if (root) root.style.marginRight = "";
		};
	}, [width]);

	const onMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isDragging.current = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";

		const onMouseMove = (ev: MouseEvent) => {
			if (!isDragging.current) return;
			const newWidth = Math.max(
				MIN_WIDTH,
				Math.min(MAX_WIDTH, window.innerWidth - ev.clientX),
			);
			setWidth(newWidth);
		};

		const onMouseUp = () => {
			isDragging.current = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			setWidth((w) => {
				try {
					localStorage.setItem(STORAGE_KEY, String(w));
				} catch {}
				return w;
			});
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}, []);

	return (
		<div
			className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-bg-primary border-l border-border-primary"
			style={{ width: `${String(width)}px` }}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle */}
			<div
				onMouseDown={onMouseDown}
				className="absolute top-0 left-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/40 transition-colors z-10"
			/>
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
