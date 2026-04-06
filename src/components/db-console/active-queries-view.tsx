import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	CodeEditor,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../../AidboxClient";
import { psqlRequest } from "./tables-view";

// Types

type ActiveQuery = {
	pid: number;
	query: string;
	state: string;
	duration_seconds: number;
	usename: string;
	wait_event_type: string | null;
	wait_event: string | null;
};

// Data fetching

const ACTIVE_QUERIES_SQL = `SELECT DISTINCT ON (query) pid, query, state,
  EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,1) as duration_seconds,
  usename, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_stat_activity%'
  AND pid != pg_backend_pid()
ORDER BY query, query_start`;

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	if (seconds < 3600)
		return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function truncateQuery(query: string, maxLen = 60): string {
	const normalized = query.trim().replace(/\s+/g, " ");
	if (normalized.length <= maxLen) return normalized;
	return `${normalized.slice(0, maxLen)}...`;
}

// Components

function ActiveQueryItem({
	query,
	onCancel,
}: {
	query: ActiveQuery;
	onCancel: (pid: number) => void;
}) {
	const [isAlertOpen, setIsAlertOpen] = useState(false);

	const formattedQuery = useMemo(() => {
		try {
			return formatSQL(query.query, {
				language: "postgresql",
				indentStyle: "tabularRight",
			});
		} catch {
			return query.query;
		}
	}, [query.query]);

	return (
		<>
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-2 px-3 py-2 border-b border-border-secondary last:border-b-0 hover:bg-bg-secondary">
						<span className="typo-body-xs leading-4! text-text-secondary truncate flex-1 min-w-0">
							{truncateQuery(query.query)}
						</span>
						<span className="typo-label-xs text-text-warning-primary shrink-0">
							{formatDuration(query.duration_seconds)}
						</span>
						<Button
							variant="ghost"
							size="small"
							className="shrink-0 size-6! p-0!"
							onClick={(e) => {
								e.stopPropagation();
								setIsAlertOpen(true);
							}}
						>
							<X className="size-3.5 text-text-tertiary" />
						</Button>
					</div>
				</TooltipTrigger>
				<TooltipContent side="right" className="max-w-md p-0">
					<div className="p-2 flex flex-col gap-1">
						<pre className="typo-body-xs font-mono whitespace-pre-wrap">
							{query.query}
						</pre>
						<div className="typo-label-xs text-text-tertiary flex gap-2 pt-1 border-t border-border-secondary">
							<span>PID: {query.pid}</span>
							<span>Duration: {formatDuration(query.duration_seconds)}</span>
							<span>User: {query.usename}</span>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogContent className="max-w-lg">
					<AlertDialogHeader>
						<AlertDialogTitle>Cancel query</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>
						Are you sure you want to cancel this query? (PID: {query.pid})
					</AlertDialogDescription>
					<div className="overflow-hidden max-h-60 mb-5 px-6">
						<CodeEditor
							readOnly
							currentValue={formattedQuery}
							mode="sql"
							foldGutter={false}
							lineNumbers={false}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setIsAlertOpen(false)}>
							Keep running
						</AlertDialogCancel>
						<AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								onCancel(query.pid);
								setIsAlertOpen(false);
							}}
						>
							Cancel query
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function ActiveQueriesView({ isActive }: { isActive: boolean }) {
	const client = useAidboxClient();
	const [queries, setQueries] = useState<ActiveQuery[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const mountedRef = useRef(true);

	const fetchQueries = useCallback(async () => {
		try {
			const result = await psqlRequest<ActiveQuery>(client, ACTIVE_QUERIES_SQL);
			if (!mountedRef.current) return;
			setQueries(result);
			setError(null);
		} catch (err) {
			if (!mountedRef.current) return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			if (mountedRef.current) setIsLoading(false);
		}
	}, [client]);

	useEffect(() => {
		if (!isActive) return;
		mountedRef.current = true;
		fetchQueries();
		const interval = setInterval(fetchQueries, 10000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, [fetchQueries, isActive]);

	const handleCancel = useCallback(
		async (pid: number) => {
			setQueries((prev) => prev.filter((q) => q.pid !== pid));
			try {
				await psqlRequest(client, `SELECT pg_cancel_backend(${pid})`);
			} catch {
				// ignore cancel errors
			}
		},
		[client],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex items-center gap-2 text-text-secondary">
					<Loader2 className="animate-spin size-4" />
					<span className="typo-body-xs">Loading...</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 text-center">
				<div className="typo-body-xs text-text-error-primary">{error}</div>
			</div>
		);
	}

	if (queries.length === 0) {
		return (
			<div className="h-full flex items-center justify-center">
				<span className="text-text-disabled text-xl font-medium whitespace-nowrap">
					No active queries
				</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-auto">
			{queries.map((q) => (
				<ActiveQueryItem key={q.pid} query={q} onCancel={handleCancel} />
			))}
		</div>
	);
}
