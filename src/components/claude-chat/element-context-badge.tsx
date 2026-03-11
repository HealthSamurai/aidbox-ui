import { Badge } from "@health-samurai/react-components";
import { X } from "lucide-react";
import { useChatDispatch, useChatState } from "./chat-context";

export function ElementContextBadge() {
	const { elementContext } = useChatState();
	const dispatch = useChatDispatch();

	if (!elementContext) return null;

	return (
		<Badge
			variant="secondary"
			className="flex items-center gap-1 text-xs min-w-0 max-w-full"
		>
			<span className="truncate">
				{elementContext.componentName !== "unknown"
					? elementContext.componentName
					: `<${elementContext.tagName}>`}
				{elementContext.routePath && (
					<span className="opacity-60"> · {elementContext.routePath}</span>
				)}
			</span>
			<button
				type="button"
				className="ml-1 hover:opacity-70"
				onClick={() => dispatch({ type: "set_element_context", context: null })}
			>
				<X className="size-3" />
			</button>
		</Badge>
	);
}
