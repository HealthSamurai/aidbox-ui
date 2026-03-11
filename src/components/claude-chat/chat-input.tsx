import { IconButton, Textarea } from "@health-samurai/react-components";
import { Crosshair, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useChatDispatch, useChatState } from "./chat-context";
import { ElementContextBadge } from "./element-context-badge";
import type { ElementContext } from "./types";

export function ChatInput({
	onSend,
}: {
	onSend: (id: string, content: string, contexts?: ElementContext[]) => void;
}) {
	const [value, setValue] = useState("");
	const { status, elementContexts, messages } = useChatState();
	const dispatch = useChatDispatch();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const isStreaming = messages.some((m) => m.isStreaming);
	const canSend = value.trim() && status === "connected" && !isStreaming;

	function handleSend() {
		if (!canSend) return;
		const id = crypto.randomUUID();
		const contexts = elementContexts.length > 0 ? elementContexts : undefined;
		dispatch({
			type: "add_user_message",
			id,
			content: value.trim(),
			elementContexts: contexts,
		});
		onSend(id, value.trim(), contexts);
		setValue("");
		textareaRef.current?.focus();
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	return (
		<div className="border-t border-border-primary p-3 shrink-0">
			<ElementContextBadge />
			<div className="flex items-center gap-1.5 mt-1 min-w-0">
				<IconButton
					variant="ghost"
					className="size-8 shrink-0"
					icon={<Crosshair className="size-4" />}
					aria-label="Pick an element"
					onClick={() => dispatch({ type: "set_picker", active: true })}
				/>
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Describe what to fix..."
					className="min-h-[2.5rem] min-w-0 max-h-32 resize-none text-sm"
					rows={1}
				/>
				<IconButton
					className="size-8 shrink-0"
					disabled={!canSend}
					icon={<Send className="size-4" />}
					aria-label="Send"
					onClick={handleSend}
				/>
			</div>
		</div>
	);
}
