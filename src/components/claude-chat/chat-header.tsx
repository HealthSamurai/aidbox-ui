import { Badge, IconButton } from "@health-samurai/react-components";
import { X } from "lucide-react";
import { useChatDispatch, useChatState } from "./chat-context";

export function ChatHeader() {
	const { status } = useChatState();
	const dispatch = useChatDispatch();

	const statusColor =
		status === "connected"
			? "bg-green-500"
			: status === "connecting"
				? "bg-yellow-500"
				: "bg-red-500";

	return (
		<div className="flex items-center justify-between px-3 py-2 border-b border-border-primary shrink-0">
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium text-text-primary">
					Claude Chat
				</span>
				<Badge variant="outline" className="flex items-center gap-1.5 text-xs">
					<span className={`size-1.5 rounded-full ${statusColor}`} />
					{status}
				</Badge>
			</div>
			<IconButton
				variant="ghost"
				className="size-6"
				icon={<X className="size-3.5" />}
				aria-label="Close"
				onClick={() => dispatch({ type: "close" })}
			/>
		</div>
	);
}
