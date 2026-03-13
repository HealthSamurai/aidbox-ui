import { Badge } from "@health-samurai/react-components";
import { Copy, X } from "lucide-react";
import { useChatDispatch, useChatState } from "./chat-context";
import { formatElementContexts } from "./types";

export function ElementContextBadge() {
	const { elementContexts } = useChatState();
	const dispatch = useChatDispatch();

	if (elementContexts.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-1">
			{elementContexts.map((ctx, i) => (
				<Badge
					key={`${ctx.selector}-${String(i)}`}
					variant="secondary"
					className="flex items-center gap-1 text-xs min-w-0 max-w-full"
				>
					<span className="truncate">
						{ctx.componentName !== "unknown"
							? ctx.componentName
							: `<${ctx.tagName}>`}
					</span>
					<button
						type="button"
						className="ml-0.5 hover:opacity-70 shrink-0"
						onClick={() =>
							dispatch({ type: "remove_element_context", index: i })
						}
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}
			<button
				type="button"
				className="text-text-secondary hover:text-text-primary shrink-0"
				onClick={() =>
					navigator.clipboard.writeText(formatElementContexts(elementContexts))
				}
			>
				<Copy className="size-3.5" />
			</button>
			{elementContexts.length > 1 && (
				<button
					type="button"
					className="text-xs text-text-secondary hover:text-text-primary"
					onClick={() => dispatch({ type: "clear_element_contexts" })}
				>
					Clear all
				</button>
			)}
		</div>
	);
}
