import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { psqlRequest } from "../db-console/tables-view";
import { EmptyState } from "../empty-state";
import { formatBytes, formatCount } from "./format";
import { formatStatement, rpcCall } from "./suggest-index";
import type { SearchParamIndex } from "./types";

const formatSubtype = (s: string | null) => (s == null ? "(default)" : s);

const SqlRow = ({ definition }: { definition: string }) => {
	const formatted = React.useMemo(
		() => formatStatement(definition),
		[definition],
	);
	const lineCount = formatted.split("\n").length;
	const height = Math.min(Math.max(lineCount, 2), 12) * 22 + 16;
	return (
		<div
			style={{ height }}
			className="[&_.cm-cursor]:!hidden [&_.cm-content]:!caret-transparent [&_.cm-activeLine]:!bg-transparent border border-border-secondary rounded overflow-hidden"
		>
			<HSComp.CodeEditor
				readOnly
				isReadOnlyTheme
				lineNumbers={false}
				foldGutter={false}
				currentValue={formatted}
				mode="sql"
				viewCallback={(view) => {
					view.contentDOM.contentEditable = "false";
				}}
			/>
		</div>
	);
};

const RowActions = ({
	row,
	onCreate,
	onDrop,
	pending,
}: {
	row: SearchParamIndex;
	onCreate: () => void;
	onDrop: () => void;
	pending: boolean;
}) => {
	if (row.exists) {
		return (
			<HSComp.Button
				variant="ghost"
				size="small"
				danger
				disabled={pending}
				onClick={onDrop}
			>
				<Lucide.Trash2Icon size={14} />
				Drop
			</HSComp.Button>
		);
	}
	return (
		<HSComp.Button
			variant="primary"
			size="small"
			disabled={pending}
			onClick={onCreate}
		>
			<Lucide.PlayIcon size={14} />
			Create
		</HSComp.Button>
	);
};

export const IndexesTab = ({
	client,
	bases,
	code,
}: {
	client: AidboxClientR5;
	bases: string[];
	code: string;
}) => {
	const queryClient = ReactQuery.useQueryClient();
	// Sort so reordering `base` in the resource doesn't break query caching.
	const sortedBases = React.useMemo(() => [...bases].sort(), [bases]);
	const indexesKey = [
		"search-parameter-builder/indexes",
		sortedBases.join(","),
		code,
	] as const;

	const indexesQuery = ReactQuery.useQuery({
		queryKey: indexesKey,
		enabled: bases.length > 0 && Boolean(code),
		queryFn: async () => {
			const json = await rpcCall(
				client,
				"aidbox.index/list-search-param-indexes",
				{ "resource-types": bases, "search-param": code },
			);
			return (json.result ?? []) as SearchParamIndex[];
		},
		retry: false,
	});

	const rows = indexesQuery.data ?? [];

	const [confirmDrop, setConfirmDrop] = React.useState<SearchParamIndex | null>(
		null,
	);
	const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
	const toggleExpanded = (name: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});

	const createMutation = ReactQuery.useMutation({
		mutationFn: async (statement: string) => {
			// `CREATE INDEX CONCURRENTLY` rejects transactions; the autocommit
			// header turns off the SQL handler's tx wrapper.
			await psqlRequest(client, statement, { autocommit: true });
		},
		onSuccess: (_data, statement) => {
			HSComp.toast.success(`Created index`, defaultToastPlacement);
			queryClient.invalidateQueries({ queryKey: indexesKey });
			void statement;
		},
		onError: ApiUtils.onMutationError,
	});

	const dropMutation = ReactQuery.useMutation({
		mutationFn: async ({ base, name }: { base: string; name: string }) => {
			await rpcCall(client, "aidbox.index/drop-search-param-index", {
				"resource-type": base,
				"search-param": code,
				"index-name": name,
			});
		},
		onSuccess: (_d, { name }) => {
			HSComp.toast.success(`Dropped ${name}`, defaultToastPlacement);
			queryClient.invalidateQueries({ queryKey: indexesKey });
		},
		onError: ApiUtils.onMutationError,
	});

	if (bases.length === 0 || !code) {
		return (
			<div className="p-4 text-text-secondary text-sm">
				Indexes require both <code>base</code> and <code>code</code> on the
				SearchParameter resource.
			</div>
		);
	}

	const isLoading = indexesQuery.isLoading;
	const pending = createMutation.isPending || dropMutation.isPending;

	return (
		<div className="flex flex-col h-full">
			<div className="grow min-h-0 overflow-y-auto overflow-x-hidden">
				{isLoading && (
					<div className="text-text-secondary text-sm">Loading indexes…</div>
				)}
				{!isLoading && rows.length === 0 && (
					<EmptyState
						title="No indexes"
						description={
							<>
								No candidate indexes were suggested for <code>{code}</code> on{" "}
								<code>{bases.join(", ")}</code>.
							</>
						}
					/>
				)}
				{!isLoading && rows.length > 0 && (
					<HSComp.Table className="typo-code w-full">
						<HSComp.TableHeader>
							<HSComp.TableRow>
								<HSComp.TableHead style={{ width: 32 }}>
									<span className="sr-only">Expand</span>
								</HSComp.TableHead>
								<HSComp.TableHead>Base</HSComp.TableHead>
								<HSComp.TableHead>Name</HSComp.TableHead>
								<HSComp.TableHead>Modifiers</HSComp.TableHead>
								<HSComp.TableHead className="text-right" style={{ width: 80 }}>
									Scans
								</HSComp.TableHead>
								<HSComp.TableHead className="text-right" style={{ width: 110 }}>
									Tuples read
								</HSComp.TableHead>
								<HSComp.TableHead className="text-right" style={{ width: 130 }}>
									Tuples fetched
								</HSComp.TableHead>
								<HSComp.TableHead className="text-right" style={{ width: 90 }}>
									Size
								</HSComp.TableHead>
								<HSComp.TableHead style={{ width: 100 }}>
									<span className="sr-only">Actions</span>
								</HSComp.TableHead>
							</HSComp.TableRow>
						</HSComp.TableHeader>
						<HSComp.TableBody>
							{rows.map((r) => {
								const rowKey = `${r.base}::${r.name}`;
								const isExpanded = expanded.has(rowKey);
								return (
									<React.Fragment key={rowKey}>
										<HSComp.TableRow
											className={`cursor-pointer ${isExpanded ? "border-b-0" : ""}`}
											onClick={() => toggleExpanded(rowKey)}
										>
											<HSComp.TableCell className="px-2 align-top">
												{isExpanded ? (
													<Lucide.ChevronDownIcon className="size-4 text-text-secondary" />
												) : (
													<Lucide.ChevronRightIcon className="size-4 text-text-secondary" />
												)}
											</HSComp.TableCell>
											<HSComp.TableCell className="align-top whitespace-nowrap">
												{r.base}
											</HSComp.TableCell>
											<HSComp.TableCell className="align-top break-all">
												{r.name}
											</HSComp.TableCell>
											<HSComp.TableCell className="align-top">
												{r.subtypes.length === 0 ? (
													<span className="text-text-tertiary">—</span>
												) : (
													<div className="flex gap-1 whitespace-nowrap">
														{r.subtypes.map((st) => {
															const label = formatSubtype(st);
															return (
																<span
																	key={label}
																	className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary font-mono"
																>
																	{label}
																</span>
															);
														})}
													</div>
												)}
											</HSComp.TableCell>
											<HSComp.TableCell className="text-right tabular-nums align-top">
												{r.exists ? formatCount(r.scans) : "—"}
											</HSComp.TableCell>
											<HSComp.TableCell className="text-right tabular-nums align-top">
												{r.exists ? formatCount(r.tuples_read) : "—"}
											</HSComp.TableCell>
											<HSComp.TableCell className="text-right tabular-nums align-top">
												{r.exists ? formatCount(r.tuples_fetched) : "—"}
											</HSComp.TableCell>
											<HSComp.TableCell className="text-right tabular-nums align-top">
												{r.exists ? formatBytes(r.size_bytes) : "—"}
											</HSComp.TableCell>
											<HSComp.TableCell
												className="text-center align-middle"
												onClick={(e) => e.stopPropagation()}
											>
												<RowActions
													row={r}
													pending={pending}
													onCreate={() => createMutation.mutate(r.definition)}
													onDrop={() => setConfirmDrop(r)}
												/>
											</HSComp.TableCell>
										</HSComp.TableRow>
										{isExpanded && (
											<tr className="hover:bg-transparent">
												<td
													colSpan={9}
													className="p-4 border-b border-border-secondary"
												>
													<SqlRow definition={r.definition} />
												</td>
											</tr>
										)}
									</React.Fragment>
								);
							})}
						</HSComp.TableBody>
					</HSComp.Table>
				)}
			</div>

			<HSComp.AlertDialog
				open={confirmDrop !== null}
				onOpenChange={(o) => !o && setConfirmDrop(null)}
			>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Drop index</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						Drop index "{confirmDrop?.name}"? This action cannot be undone.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel onClick={() => setConfirmDrop(null)}>
							Cancel
						</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								const target = confirmDrop;
								setConfirmDrop(null);
								if (target)
									dropMutation.mutate({
										base: target.base,
										name: target.name,
									});
							}}
						>
							Drop index
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</div>
	);
};
