import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { psqlRequest } from "../db-console/tables-view";
import { EmptyState } from "../empty-state";
import { formatBytes, formatCount, formatRelativeTime } from "./format";
import { formatStatement, rpcCall } from "./suggest-index";
import type { SearchParamIndex } from "./types";

const formatSubtype = (s: string | null) => (s == null ? "(default)" : s);

/**
 * Human-readable explanation of each FHIR/Aidbox search modifier and numeric
 * prefix. Keys are the same symbols that `suggest-index` reports in `:subtypes`
 * (kebab-case, null → default). Used to demystify cards in the Indexes tab.
 * Add new entries here as new modifiers are surfaced by the suggester.
 */
const SUBTYPE_DESCRIPTIONS: Record<string, string> = {
	"(default)":
		"Default match: starts-with for strings, exact for tokens, equality for everything else.",
	eq: "Equality. For strings, exact match; for numbers/dates, identical value.",
	ne: "Not equal.",
	exact: "Exact, case- and accent-sensitive string match.",
	starts: "Case-insensitive starts-with match (string).",
	sw: "Same as `:starts` — case-insensitive starts-with (string).",
	ends: "Case-insensitive ends-with match (string).",
	ew: "Same as `:ends` — case-insensitive ends-with (string).",
	contains:
		"Case-insensitive contains-anywhere match (string). Powered by gin_trgm_ops.",
	co: "Same as `:contains`.",
	text: "Free-text search across multiple element paths of the resource.",
	otherwise: "Fallback path when no modifier matches.",
	not: "Excludes matches with the given value (token).",
	"not-in": "Excludes codes that belong to the given ValueSet (token).",
	in: "Limits results to codes in the given ValueSet (token).",
	above: "Token/reference value is an ancestor of the given code/reference.",
	below: "Token/reference value is a descendant of the given code/reference.",
	"of-type": "Token typed-match: system + code + value (e.g. identifier).",
	identifier: "Match reference by `Identifier` instead of literal reference.",
	type: "Match reference by `Reference.type`.",
	missing: "Matches resources where the element is missing or present.",
	lt: "Numeric/date prefix: less than.",
	le: "Numeric/date prefix: less than or equal.",
	gt: "Numeric/date prefix: greater than.",
	ge: "Numeric/date prefix: greater than or equal.",
	ap: "Numeric/date prefix: approximately equal (within 10%).",
	sa: "Date prefix: starts after.",
	eb: "Date prefix: ends before.",
};

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
			HSComp.toast.success("Index created", defaultToastPlacement);
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
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Loading...</div>
						</div>
					</div>
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
									Calls
								</HSComp.TableHead>
								<HSComp.TableHead className="text-right" style={{ width: 80 }}>
									Shapes
								</HSComp.TableHead>
								<HSComp.TableHead style={{ width: 110 }}>
									Last hit
								</HSComp.TableHead>
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
								// Hot unindexed candidate — searches are happening that
								// would benefit from this index, but it doesn't exist.
								// Yellow tint draws the user to "create me first".
								const isHotMissing = !r.exists && r.hit_calls > 0;
								return (
									<React.Fragment key={rowKey}>
										<HSComp.TableRow
											className={`cursor-pointer ${isExpanded ? "border-b-0" : ""} ${isHotMissing ? "bg-bg-warning-secondary" : ""}`}
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
												{r.hit_calls > 0 ? (
													formatCount(r.hit_calls)
												) : (
													<span className="text-text-tertiary">0</span>
												)}
											</HSComp.TableCell>
											<HSComp.TableCell className="text-right tabular-nums align-top">
												{r.hit_shapes > 0 ? (
													formatCount(r.hit_shapes)
												) : (
													<span className="text-text-tertiary">0</span>
												)}
											</HSComp.TableCell>
											<HSComp.TableCell
												className="whitespace-nowrap align-top"
												title={r.hit_last_used_at ?? undefined}
											>
												{r.hit_last_used_at ? (
													formatRelativeTime(r.hit_last_used_at)
												) : (
													<span className="text-text-tertiary">—</span>
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
													colSpan={12}
													className="p-4 border-b border-border-secondary"
												>
													<SqlRow definition={r.definition} />
													{r.subtypes.length > 0 && (
														<div className="mt-3">
															<div className="text-xs font-medium text-text-secondary mb-1">
																Covers
															</div>
															<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
																{r.subtypes.map((st) => {
																	const label = formatSubtype(st);
																	const desc = SUBTYPE_DESCRIPTIONS[label];
																	return (
																		<React.Fragment key={label}>
																			<dt className="font-mono text-text-secondary">
																				{label}
																			</dt>
																			<dd className="text-text-secondary">
																				{desc ?? (
																					<span className="text-text-tertiary">
																						(no description)
																					</span>
																				)}
																			</dd>
																		</React.Fragment>
																	);
																})}
															</dl>
														</div>
													)}
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
