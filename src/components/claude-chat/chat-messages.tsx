import { ScrollArea } from "@health-samurai/react-components";
import { useEffect, useRef } from "react";
import { useChatState } from "./chat-context";
import { ChatMessageBubble } from "./chat-message";

export function ChatMessages() {
	const { messages } = useChatState();
	const bottomRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every messages change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<ScrollArea className="flex-1 min-h-0">
			<div className="flex flex-col gap-2 py-3 px-3 min-w-0">
				{messages.length === 0 && (
					<div className="text-center text-sm text-text-secondary py-8">
						Send a message or pick an element to start
					</div>
				)}
				{messages.map((msg) => (
					<ChatMessageBubble key={msg.id} message={msg} />
				))}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
