import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import { EmptyState } from "../../empty-state";
import { formatRowCount, ResultTable } from "../result-table";
import { useLineageRunContext } from "./run-context";

function ResultBody() {
	const { runResult, runError, runningNodeId } = useLineageRunContext();

	if (runningNodeId) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Running…
			</div>
		);
	}

	if (runError) {
		return (
			<HSComp.OperationOutcomeView
				resource={runError}
				className="h-full overflow-auto"
			/>
		);
	}

	if (!runResult) {
		return (
			<EmptyState
				title="No results yet"
				description="Click Run on a node to execute it"
				grayscale
			/>
		);
	}

	if (runResult.rows.length === 0) {
		return (
			<EmptyState
				title="No results"
				description="The query executed successfully but returned no data"
			/>
		);
	}

	return <ResultTable columns={runResult.columns} rows={runResult.rows} />;
}

export function LineageResultPanel({
	isMaximized,
	onToggleMaximize,
	onToggleCollapse,
}: {
	isMaximized: boolean;
	onToggleMaximize: () => void;
	onToggleCollapse: () => void;
}) {
	const { runResult } = useLineageRunContext();

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex gap-1 items-center justify-between bg-bg-secondary px-4 pr-2 border-b h-10 shrink-0">
				<span className="typo-label text-text-secondary">Result</span>
				<div className="flex items-center gap-1">
					{runResult && (
						<span className="typo-body-xs text-text-secondary mr-1">
							{formatRowCount(runResult.rows.length)}
						</span>
					)}
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={onToggleCollapse}
							>
								<PanelBottomClose className="w-4 h-4" />
							</HSComp.Button>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent align="end">Collapse</HSComp.TooltipContent>
					</HSComp.Tooltip>
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={onToggleMaximize}
							>
								{isMaximized ? (
									<Minimize2 className="w-4 h-4" />
								) : (
									<Maximize2 className="w-4 h-4" />
								)}
							</HSComp.Button>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent align="end">
							{isMaximized ? "Minimize" : "Maximize"}
						</HSComp.TooltipContent>
					</HSComp.Tooltip>
				</div>
			</div>
			<div className="flex-1 min-h-0">
				<ResultBody />
			</div>
		</div>
	);
}
