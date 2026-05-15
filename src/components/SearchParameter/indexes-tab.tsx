import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { EmptyState } from "../empty-state";
import { formatBytes, formatCount, formatRelativeTime } from "./format";
import { formatStatement, rpcCall } from "./suggest-index";
import type { SearchParamIndex } from "./types";

const formatSubtype = (s: string | null) => (s == null ? "(default)" : s);

/**
 * Example value strings per modifier — pasted after `=` in the URL. Concrete
 * payloads make it obvious what the modifier actually does at the wire
 * level. Anything not listed gets a generic `value` placeholder.
 *
 * Modifier semantics: https://hl7.org/fhir/R4/search.html#modifiers
 */
const SUBTYPE_VALUE_EXAMPLES: Record<string, string> = {
	"(default)": "value",
	eq: "value",
	ne: "value",
	exact: "Smith",
	starts: "Sm",
	sw: "Sm",
	ends: "ith",
	ew: "ith",
	contains: "ith",
	co: "ith",
	text: "diabetes",
	otherwise: "value",
	not: "value",
	"not-in": "http://hl7.org/fhir/ValueSet/example",
	in: "http://hl7.org/fhir/ValueSet/example",
	above: "http://snomed.info/sct|73211009",
	below: "http://snomed.info/sct|73211009",
	"of-type": "http://terminology.hl7.org/CodeSystem/v2-0203|MR|446053",
	identifier: "http://acme.org/mrn|446053",
	type: "Patient",
	missing: "true",
	lt: "lt100",
	le: "le100",
	gt: "gt100",
	ge: "ge100",
	ap: "ap100",
	sa: "sa2020-01-01",
	eb: "eb2020-01-01",
};

/**
 * Build the example request URL for a given (base, code, subtype) tuple.
 * Default subtype renders without the colon segment (`?code=value`); any
 * named modifier appends `:modifier`. Value placeholder comes from
 * `SUBTYPE_VALUE_EXAMPLES`; falls back to `value`.
 *
 * The `lt` / `ge` / `ap` etc. entries above are date/number *prefixes*
 * (typed inline with the value), not modifiers. They land here too so
 * indexes that the suggester reports as covering them get an example.
 */
const PREFIX_SUBTYPES = new Set([
	"lt",
	"le",
	"gt",
	"ge",
	"ap",
	"sa",
	"eb",
	"ne",
	"eq",
]);

function subtypeExample(base: string, code: string, subtype: string): string {
	const example = SUBTYPE_VALUE_EXAMPLES[subtype] ?? "value";
	if (subtype === "(default)") return `GET /fhir/${base}?${code}=${example}`;
	if (PREFIX_SUBTYPES.has(subtype)) {
		// Prefix goes on the value, not the param name.
		return `GET /fhir/${base}?${code}=${example}`;
	}
	return `GET /fhir/${base}?${code}:${subtype}=${example}`;
}

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
	if (row.building) {
		// Postgres is mid-CREATE INDEX. Block the second click and signal
		// progress; the polling indexes-query will flip this off once
		// `pg_stat_progress_create_index` drops the entry.
		return (
			<HSComp.Button variant="secondary" size="small" disabled>
				Building…
			</HSComp.Button>
		);
	}
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
				{
					"resource-types": bases,
					"search-param": code,
					// Drain the in-memory stats buffer first so `Calls` matches
					// what the Stats tab shows (both request `flush-first`).
					"flush-first": true,
				},
			);
			return (json.result ?? []) as SearchParamIndex[];
		},
		// Poll while any candidate is mid-build so the row flips from
		// "Building…" → "Drop" as soon as pg finishes. Otherwise the data is
		// fresh-on-mount; no need to refetch.
		refetchInterval: (q) =>
			(q.state.data ?? []).some((r) => r.building) ? 3000 : false,
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
		mutationFn: async ({
			statement,
		}: {
			base: string;
			name: string;
			statement: string;
		}) => {
			// `CREATE INDEX CONCURRENTLY` rejects transactions, so we send
			// `Aidbox-Sql-Autocommit: true`. `Aidbox-Sql-Async: true` kicks the
			// statement off into Aidbox's async-api scheduler so the HTTP call
			// returns `202` immediately with an operation-id — the browser
			// doesn't sit on an open connection while pg builds. The indexes
			// query polls `pg_stat_progress_create_index` (via `:building` on
			// each row) to know when to refresh.
			const res = await client.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: {
					"Content-Type": "application/json",
					"Aidbox-Sql-Autocommit": "true",
					"Aidbox-Sql-Async": "true",
				},
				body: JSON.stringify({ query: statement }),
			});
			if (!res.response.ok)
				throw new Error(`HTTP ${res.response.status} from /$psql`);
		},
		onSuccess: (_data, { base, name }) => {
			HSComp.toast.success("Index creation started", defaultToastPlacement);
			// Optimistically mark this row as building. `Aidbox-Sql-Async: true`
			// returns 202 before pg has even started CREATE INDEX CONCURRENTLY,
			// so an immediate refetch would still see `pg_stat_progress_create_index`
			// empty → `:building false` → polling never starts. Patching the
			// cache here flips `(some r.building)` to true, which arms the 3 s
			// refetch loop; pg's view of truth takes over from the next tick.
			queryClient.setQueryData<SearchParamIndex[]>(indexesKey, (prev) =>
				(prev ?? []).map((r) =>
					r.base === base && r.name === name ? { ...r, building: true } : r,
				),
			);
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
													onCreate={() =>
														createMutation.mutate({
															base: r.base,
															name: r.name,
															statement: r.definition,
														})
													}
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
															<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
																{r.subtypes.map((st) => {
																	const label = formatSubtype(st);
																	const example = subtypeExample(
																		r.base,
																		code,
																		label,
																	);
																	return (
																		<React.Fragment key={label}>
																			<dt className="font-mono text-text-secondary">
																				{label}
																			</dt>
																			<dd className="font-mono text-text-secondary break-all">
																				{example}
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
