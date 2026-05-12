import * as HSComp from "@health-samurai/react-components";
import { EmptyState } from "../empty-state";
import { useSQLQueryContext } from "./context";

function ResultBody() {
	const { runResult, isRunning } = useSQLQueryContext();

	if (isRunning) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Running…
			</div>
		);
	}

	if (!runResult) {
		return (
			<EmptyState
				title="No results yet"
				description="Click Run to execute the query"
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

	return (
		<div className="h-full overflow-auto">
			<HSComp.Table zebra className="typo-code">
				<HSComp.TableHeader>
					<HSComp.TableRow>
						{runResult.columns.map((col) => (
							<HSComp.TableHead key={col}>{col}</HSComp.TableHead>
						))}
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{runResult.rows.map((row, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
						<HSComp.TableRow key={i} zebra index={i}>
							{runResult.columns.map((col, j) => {
								const v = row[j];
								return (
									<HSComp.TableCell key={col}>
										{v === null || v === undefined
											? "—"
											: typeof v === "object"
												? JSON.stringify(v)
												: String(v)}
									</HSComp.TableCell>
								);
							})}
						</HSComp.TableRow>
					))}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}

export function ResultPanel() {
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center bg-bg-secondary px-4 h-10 border-b shrink-0">
				<span className="typo-label text-text-secondary">Result</span>
			</div>
			<div className="flex-1 min-h-0">
				<ResultBody />
			</div>
		</div>
	);
}
