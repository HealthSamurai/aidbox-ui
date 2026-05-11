import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import { format as formatSQL } from "sql-formatter";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
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
	onCreated,
}: {
	client: AidboxClientR5;
	suggestion: { name: string; statement: string };
	onCreated?: () => void;
}) => {
	const lineCount = suggestion.statement.split("\n").length;
	const height = Math.min(Math.max(lineCount, 2), 12) * 22 + 16;

	const runMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			// `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block;
			// matches the SQL console's "autocommit" toggle header.
			await psqlRequest(client, suggestion.statement, { autocommit: true });
		},
		onSuccess: () => {
			HSComp.toast.success(`Created ${suggestion.name}`, defaultToastPlacement);
			onCreated?.();
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
