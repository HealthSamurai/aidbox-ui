import * as HSComp from "@health-samurai/react-components";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuIcon,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { EllipsisIcon, PlayIcon, SaveIcon } from "lucide-react";
import * as React from "react";

type ToolbarMode = "full" | "icons" | "collapsed";

function useToolbarMode(
	ref: React.RefObject<HTMLDivElement | null>,
): ToolbarMode {
	const [mode, setMode] = React.useState<ToolbarMode>("full");

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width === undefined) return;
			if (width >= 400) setMode("full");
			else if (width >= 240) setMode("icons");
			else setMode("collapsed");
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);

	return mode;
}

export function EditorHeaderMenu({
	onSave,
	onExpand,
	isSaveDisabled,
	isExpandDisabled,
}: {
	onSave: () => void;
	onExpand: () => void;
	isSaveDisabled?: boolean;
	isExpandDisabled?: boolean;
}) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const mode = useToolbarMode(containerRef);

	return (
		<div
			ref={containerRef}
			className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b"
		>
			{mode === "collapsed" ? (
				<div className="flex items-center gap-1 px-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<HSComp.IconButton
								variant="ghost"
								aria-label="More actions"
								icon={<EllipsisIcon className="w-4 h-4" />}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onSelect={onExpand}
								disabled={isExpandDisabled}
								className="text-text-link!"
							>
								EXPAND
								<DropdownMenuIcon>
									<PlayIcon className="fill-current text-text-link" />
								</DropdownMenuIcon>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onSave} disabled={isSaveDisabled}>
								Save
								<DropdownMenuIcon>
									<SaveIcon />
								</DropdownMenuIcon>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			) : (
				<div className="flex items-center gap-4 px-4">
					<Tooltip disableHoverableContent={mode === "full"}>
						<TooltipTrigger asChild>
							<HSComp.Button
								variant="link"
								size="small"
								className="px-0! text-text-link! hover:text-text-link/80!"
								onClick={onExpand}
								disabled={isExpandDisabled}
							>
								<PlayIcon className="w-4 h-4 fill-current" />
								{mode === "full" && "EXPAND"}
							</HSComp.Button>
						</TooltipTrigger>
						{mode !== "full" && <TooltipContent>Expand</TooltipContent>}
					</Tooltip>
					<HSComp.Separator orientation="vertical" className="h-6!" />
					<Tooltip disableHoverableContent={mode === "full"}>
						<TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								className="px-0!"
								onClick={onSave}
								disabled={isSaveDisabled}
							>
								<SaveIcon className="w-4 h-4" />
								{mode === "full" && "Save"}
							</HSComp.Button>
						</TooltipTrigger>
						{mode !== "full" && <TooltipContent>Save</TooltipContent>}
					</Tooltip>
				</div>
			)}
		</div>
	);
}
