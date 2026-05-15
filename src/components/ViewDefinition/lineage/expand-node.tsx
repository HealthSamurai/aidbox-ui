import { Handle, Position } from "@xyflow/react";
import { ChevronsRight, Loader2 } from "lucide-react";
import * as React from "react";
import { useExpandContext } from "./expand-context";
import type { ExpandPlaceholderNodeData } from "./types";

type Props = {
	id: string;
	data: Record<string, unknown>;
	selected?: boolean;
};

export function ExpandPlaceholderNode({ id, data, selected }: Props) {
	const d = data as unknown as ExpandPlaceholderNodeData;
	const { expand, expandingNodeId } = useExpandContext();
	const isLoading = expandingNodeId === id;

	const handleClick = React.useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (isLoading) return;
			expand(d.queryNodeId);
		},
		[expand, d.queryNodeId, isLoading],
	);

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isLoading}
			aria-label="Expand backrefs"
			className={`flex items-center justify-center w-8 h-8 rounded-full bg-bg-primary border shadow-sm transition-colors ${
				selected ? "border-border-link" : "border-border-primary"
			} hover:border-border-link hover:bg-bg-secondary disabled:opacity-60 disabled:cursor-not-allowed`}
		>
			{isLoading ? (
				<Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
			) : (
				<ChevronsRight className="w-4 h-4 text-text-secondary" />
			)}
			<Handle
				type="target"
				position={Position.Left}
				className="w-2 h-2 left-0!"
				isConnectable={false}
			/>
		</button>
	);
}
