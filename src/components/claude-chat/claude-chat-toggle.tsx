import {
	IconButton,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Wand2 } from "lucide-react";
import { useChatDispatch, useChatState } from "./chat-context";

export default function ClaudeChatToggle() {
	const { isOpen } = useChatState();
	const dispatch = useChatDispatch();
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<IconButton
					variant={isOpen ? "default" : "ghost"}
					className="size-7 rounded-full"
					icon={<Wand2 className="size-4" />}
					aria-label="Claude Chat"
					onClick={() => dispatch({ type: "toggle" })}
				/>
			</TooltipTrigger>
			<TooltipContent side="bottom">Claude Chat</TooltipContent>
		</Tooltip>
	);
}
