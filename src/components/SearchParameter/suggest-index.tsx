import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import { format as formatSQL } from "sql-formatter";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { appendSqlTabs } from "../db-console/active-tabs";
import { psqlRequest } from "../db-console/tables-view";

export type SuggestedIndex = {
	"index-name": string;
	type?: string;
	statement: string;
	"resource-type"?: string;
	subtypes?: (string | null)[];
};

export async function rpcCall(
	client: AidboxClientR5,
	method: string,
	params: Record<string, unknown>,
) {
	const response = await client.rawRequest({
		method: "POST",
		url: `/rpc?_m=${method}`,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ method, params }),
	});
	const json = await response.response.json();
	if (json.error) throw new Error(json.error.message || "RPC error");
	return json;
}

export function formatStatement(sql: string): string {
	try {
		return formatSQL(sql, { language: "postgresql" });
	} catch {
		return sql;
	}
}

export const SuggestionCard = ({
	client,
	suggestion,
	onEdit,
}: {
	client: AidboxClientR5;
	suggestion: { name: string; statement: string };
	onEdit: (statement: string) => void;
}) => {
	const lineCount = suggestion.statement.split("\n").length;
	const height = Math.min(Math.max(lineCount, 2), 12) * 22 + 16;

	const runMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			await psqlRequest(client, suggestion.statement);
		},
		onSuccess: () => {
			HSComp.toast.success(`Created ${suggestion.name}`, defaultToastPlacement);
		},
		onError: (err: Error) => {
			ApiUtils.toastError(`Failed to create ${suggestion.name}`, err.message);
		},
	});

	return (
		<div className="rounded border border-border-secondary overflow-hidden">
			<div className="flex items-center justify-between px-3 py-1.5 bg-bg-secondary border-b border-border-secondary">
				<span className="text-xs text-text-secondary truncate">
					{suggestion.name}
				</span>
				<div className="flex items-center gap-1 shrink-0">
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={() => onEdit(suggestion.statement)}
					>
						<Lucide.SquareTerminalIcon size={14} />
						Edit
					</HSComp.Button>
					<HSComp.Button
						variant="primary"
						size="small"
						onClick={() => runMutation.mutate()}
						disabled={runMutation.isPending || runMutation.isSuccess}
					>
						{runMutation.isSuccess ? (
							<Lucide.CheckIcon size={14} />
						) : (
							<Lucide.PlayIcon size={14} />
						)}
						{runMutation.isPending
							? "Running..."
							: runMutation.isSuccess
								? "Created"
								: "Run"}
					</HSComp.Button>
				</div>
			</div>
			<div
				style={{ height }}
				className="[&_.cm-cursor]:!hidden [&_.cm-content]:!caret-transparent [&_.cm-activeLine]:!bg-transparent"
			>
				<HSComp.CodeEditor
					readOnly
					isReadOnlyTheme
					lineNumbers={false}
					foldGutter={false}
					currentValue={suggestion.statement}
					mode="sql"
					viewCallback={(view) => {
						view.contentDOM.contentEditable = "false";
					}}
				/>
			</div>
		</div>
	);
};

export const SuggestIndexButton = ({
	client,
	resourceType,
	searchParam,
}: {
	client: AidboxClientR5;
	resourceType: string;
	searchParam: string;
}) => {
	const [open, setOpen] = React.useState(false);
	const navigate = Router.useNavigate();
	const mutation = ReactQuery.useMutation({
		mutationFn: async () => {
			const json = await rpcCall(client, "aidbox.index/suggest-index", {
				"resource-type": resourceType,
				"search-param": searchParam,
			});
			return (json.result ?? []) as SuggestedIndex[];
		},
		onError: ApiUtils.onMutationError,
	});

	const formattedStatements = React.useMemo(
		() =>
			mutation.data?.map((idx) => ({
				name: idx["index-name"],
				statement: formatStatement(idx.statement),
			})) ?? [],
		[mutation.data],
	);

	const handleClick = () => {
		setOpen(true);
		mutation.mutate();
	};

	const openInConsole = (queries: string[]) => {
		appendSqlTabs(queries);
		setOpen(false);
		navigate({ to: "/db-console", search: { query: undefined } });
	};

	return (
		<>
			<HSComp.Button
				variant="ghost"
				size="small"
				onClick={handleClick}
				disabled={!searchParam}
			>
				<Lucide.DatabaseIcon size={14} />
				Suggest index
			</HSComp.Button>

			<HSComp.Dialog open={open} onOpenChange={setOpen}>
				<HSComp.DialogContent className="sm:max-w-[90vw] w-[90vw]">
					<HSComp.DialogHeader>
						<HSComp.DialogTitle>
							Suggested indexes for {resourceType}.{searchParam}
						</HSComp.DialogTitle>
					</HSComp.DialogHeader>
					{mutation.isPending && (
						<div className="text-text-secondary">Loading...</div>
					)}
					{mutation.isError && (
						<div className="text-text-danger">{mutation.error.message}</div>
					)}
					{mutation.isSuccess && formattedStatements.length === 0 && (
						<div className="text-text-secondary">No indexes suggested.</div>
					)}
					{formattedStatements.length > 0 && (
						<>
							<div className="space-y-3 max-h-[60vh] overflow-y-auto">
								{formattedStatements.map((s) => (
									<SuggestionCard
										key={s.name}
										client={client}
										suggestion={s}
										onEdit={(stmt) => openInConsole([stmt])}
									/>
								))}
							</div>
							{formattedStatements.length > 1 && (
								<HSComp.DialogFooter>
									<HSComp.Button
										variant="secondary"
										onClick={() =>
											openInConsole(formattedStatements.map((s) => s.statement))
										}
									>
										<Lucide.SquareTerminalIcon size={14} />
										Edit all in SQL Console
									</HSComp.Button>
								</HSComp.DialogFooter>
							)}
						</>
					)}
				</HSComp.DialogContent>
			</HSComp.Dialog>
		</>
	);
};
