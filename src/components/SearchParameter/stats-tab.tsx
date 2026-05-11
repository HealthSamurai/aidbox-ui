import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { EmptyState } from "../empty-state";
import { formatCount, formatMs, formatRelativeTime } from "./format";
import {
	formatStatement,
	rpcCall,
	type SuggestedIndex,
	SuggestionCard,
} from "./suggest-index";
import type { SearchParamIndex, SearchParamShape } from "./types";

const ExistingIndexCard = ({
	client,
	resourceType,
	searchParam,
	index,
	onDropped,
}: {
	client: AidboxClientR5;
	resourceType: string;
	searchParam: string;
	index: SearchParamIndex;
	onDropped: () => void;
}) => {
	const [open, setOpen] = React.useState(false);
	const [confirmOpen, setConfirmOpen] = React.useState(false);
	const formatted = formatStatement(index.definition);
	const lineCount = formatted.split("\n").length;
	const height = Math.min(Math.max(lineCount, 2), 12) * 22 + 16;

	const dropMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			await rpcCall(client, "aidbox.index/drop-search-param-index", {
				"resource-type": resourceType,
				"search-param": searchParam,
				"index-name": index.name,
			});
		},
		onSuccess: () => {
			HSComp.toast.success(`Dropped ${index.name}`, defaultToastPlacement);
			onDropped();
		},
		onError: ApiUtils.onMutationError,
	});

	return (
		<div className="rounded border border-border-secondary overflow-hidden">
			<div className="flex items-center justify-between px-3 py-1 bg-bg-secondary border-b border-border-secondary">
				<button
					type="button"
					className="flex items-center gap-1 text-xs text-text-secondary font-mono truncate min-w-0 hover:text-text-primary"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
				>
					{open ? (
						<Lucide.ChevronDownIcon size={12} />
					) : (
						<Lucide.ChevronRightIcon size={12} />
					)}
					<span className="truncate">{index.name}</span>
				</button>
				<HSComp.Button
					variant="ghost"
					size="small"
					danger
					disabled={dropMutation.isPending}
					onClick={() => setConfirmOpen(true)}
				>
					<Lucide.Trash2Icon size={14} />
					{dropMutation.isPending ? "Dropping..." : "Drop"}
				</HSComp.Button>
			</div>
			{open && (
				<div
					style={{ height }}
					className="[&_.cm-cursor]:!hidden [&_.cm-content]:!caret-transparent [&_.cm-activeLine]:!bg-transparent"
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
			)}
			<HSComp.AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Drop index</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						Drop index "{index.name}"? This action cannot be undone. Searches
						using <code>{searchParam}</code> on <code>{resourceType}</code> may
						become slower until a replacement index is created.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel onClick={() => setConfirmOpen(false)}>
							Cancel
						</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								setConfirmOpen(false);
								dropMutation.mutate();
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

const IndexesPanel = ({
	client,
	resourceType,
	searchParam,
	existing,
	existingIsLoading,
	suggestionsQuery,
	onClose,
	onReloadSuggest,
	onExistingChanged,
}: {
	client: AidboxClientR5;
	resourceType: string;
	searchParam: string;
	existing: SearchParamIndex[];
	existingIsLoading: boolean;
	suggestionsQuery: ReactQuery.UseQueryResult<SuggestedIndex[], Error>;
	onClose: () => void;
	onReloadSuggest: () => void;
	onExistingChanged: () => void;
}) => {
	const existingNames = React.useMemo(
		() => new Set(existing.map((i) => i.name)),
		[existing],
	);

	const suggested = React.useMemo(
		() =>
			(suggestionsQuery.data ?? [])
				.filter((s) => !existingNames.has(s["index-name"]))
				.map((s) => ({
					name: s["index-name"],
					statement: formatStatement(s.statement),
				})),
		[suggestionsQuery.data, existingNames],
	);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
				<div className="flex items-center gap-2 px-4 grow">
					<span className="typo-label text-text-secondary">Indexes</span>
				</div>
				<div className="flex items-center px-2 gap-1">
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={onReloadSuggest}
						disabled={suggestionsQuery.isFetching}
					>
						<Lucide.SparklesIcon size={14} />
						{suggestionsQuery.isFetching ? "Suggesting…" : "Suggest"}
					</HSComp.Button>
					<HSComp.IconButton
						variant="ghost"
						aria-label="Close indexes panel"
						icon={<Lucide.XIcon className="w-4 h-4" />}
						onClick={onClose}
					/>
				</div>
			</div>
			<div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
				<section className="flex flex-col gap-2">
					<div className="text-sm font-medium text-text-secondary">
						Suggested
						{suggested.length > 0 ? ` (${suggested.length})` : ""}
					</div>
					{suggestionsQuery.isFetching ? (
						<div className="text-sm text-text-secondary">Loading…</div>
					) : suggestionsQuery.isError ? (
						<div className="text-sm text-text-danger">
							{suggestionsQuery.error.message}
						</div>
					) : suggested.length === 0 ? (
						<div className="text-sm text-text-tertiary">
							{suggestionsQuery.data
								? "No new suggestions — all suggested indexes already exist."
								: "Click Suggest to compute index candidates."}
						</div>
					) : (
						<div className="flex flex-col gap-2">
							{suggested.map((s) => (
								<SuggestionCard
									key={s.name}
									client={client}
									suggestion={s}
									onCreated={onExistingChanged}
								/>
							))}
						</div>
					)}
				</section>

				<section className="flex flex-col gap-2">
					<div className="text-sm font-medium text-text-secondary">
						Existing{existing.length > 0 ? ` (${existing.length})` : ""}
					</div>
					{existingIsLoading ? (
						<div className="text-sm text-text-secondary">Loading…</div>
					) : existing.length === 0 ? (
						<div className="text-sm text-text-tertiary">
							No indexes follow the SP-knife naming convention for this search
							parameter.
						</div>
					) : (
						<div className="flex flex-col gap-2">
							{existing.map((idx) => (
								<ExistingIndexCard
									key={idx.name}
									client={client}
									resourceType={resourceType}
									searchParam={searchParam}
									index={idx}
									onDropped={onExistingChanged}
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
};

export const StatsTab = ({
	client,
	base,
	code,
}: {
	client: AidboxClientR5;
	base: string;
	code: string;
}) => {
	const queryClient = ReactQuery.useQueryClient();
	const queryKey = ["search-parameter-builder/shapes", base, code] as const;
	const indexesQueryKey = [
		"search-parameter-builder/indexes",
		base,
		code,
	] as const;
	const suggestQueryKey = [
		"search-parameter-builder/suggest",
		base,
		code,
	] as const;

	const paramsLookupQueryKey = [
		"search-parameter-builder/param-lookup",
		base,
	] as const;

	const paramsLookupQuery = ReactQuery.useQuery({
		queryKey: paramsLookupQueryKey,
		enabled: Boolean(base),
		queryFn: async () => {
			const resp = await client.rawRequest({
				method: "GET",
				url: `/fhir/SearchParameter?base=${base}&_count=500&_elements=id,code`,
				headers: { "Content-Type": "application/json" },
			});
			const json = (await resp.response.json()) as {
				entry?: { resource?: { id?: string; code?: string } }[];
			};
			const map: Record<string, string> = {};
			for (const e of json.entry ?? []) {
				const id = e.resource?.id;
				const c = e.resource?.code;
				// Last-write-wins when several SPs share a code; acceptable since this
				// is just a "jump to definition" affordance.
				if (id && c) map[c] = id;
			}
			return map;
		},
		retry: false,
	});

	const shapesQuery = ReactQuery.useQuery({
		queryKey,
		enabled: Boolean(base && code),
		queryFn: async () => {
			const json = await rpcCall(
				client,
				"aidbox.index/get-search-param-stats",
				{
					"resource-type": base,
					"search-param": code,
					by: "shape",
					limit: 200,
					"flush-first": true,
				},
			);
			return (json.result ?? []) as SearchParamShape[];
		},
		retry: false,
	});

	const indexesQuery = ReactQuery.useQuery({
		queryKey: indexesQueryKey,
		enabled: Boolean(base && code),
		queryFn: async () => {
			const json = await rpcCall(
				client,
				"aidbox.index/list-search-param-indexes",
				{ "resource-type": base, "search-param": code },
			);
			return (json.result ?? []) as SearchParamIndex[];
		},
		retry: false,
	});

	const suggestQuery = ReactQuery.useQuery({
		queryKey: suggestQueryKey,
		// Lazy: only fetch when the user clicks "Suggest" in the panel.
		enabled: false,
		queryFn: async () => {
			const json = await rpcCall(client, "aidbox.index/suggest-index", {
				"resource-type": base,
				"search-param": code,
			});
			return (json.result ?? []) as SuggestedIndex[];
		},
		retry: false,
	});

	const resetAllMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			await rpcCall(client, "aidbox.index/reset-search-param-stats", {
				"resource-type": base,
				"search-param": code,
			});
		},
		onSuccess: () => {
			HSComp.toast.success(
				`Reset stats for ${base}.${code}`,
				defaultToastPlacement,
			);
			queryClient.invalidateQueries({ queryKey });
		},
		onError: ApiUtils.onMutationError,
	});

	const resetShapeMutation = ReactQuery.useMutation({
		mutationFn: async (searchParams: string[]) => {
			await rpcCall(client, "aidbox.index/reset-search-param-stats", {
				"resource-type": base,
				"search-params": searchParams,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
		},
		onError: ApiUtils.onMutationError,
	});

	const [isIndexesOpen, setIsIndexesOpen] = React.useState(false);

	if (!base || !code) {
		return (
			<div className="p-4 text-text-secondary text-sm">
				Stats require both <code>base</code> and <code>code</code> on the
				SearchParameter resource.
			</div>
		);
	}

	const shapes = shapesQuery.data ?? [];
	const indexes = indexesQuery.data ?? [];
	const paramIdByCode = paramsLookupQuery.data ?? {};

	const renderShapeParams = (params: string[]) =>
		// `params` is the per-shape sorted+distinct array from the backend, so
		// each name appears at most once — safe as a React key.
		params.map((p, i) => {
			const id = paramIdByCode[p];
			const node = id ? (
				<Router.Link
					to="/resource/$resourceType/edit/$id"
					params={{ resourceType: "SearchParameter", id }}
					search={{
						tab: "edit" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					}}
					className="text-text-link hover:underline"
				>
					{p}
				</Router.Link>
			) : (
				<span>{p}</span>
			);
			return (
				<React.Fragment key={p}>
					{i > 0 ? ", " : ""}
					{node}
				</React.Fragment>
			);
		});

	const statsBody = (
		<div className="flex flex-col h-full">
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
				<div className="flex items-center gap-1 px-2 grow">
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={() => resetAllMutation.mutate()}
						disabled={resetAllMutation.isPending || shapes.length === 0}
					>
						<Lucide.RotateCcwIcon size={14} />
						Reset all
					</HSComp.Button>
				</div>
				{!isIndexesOpen && (
					<div className="flex items-center px-2">
						<HSComp.Toggle
							variant="outline"
							pressed={isIndexesOpen}
							onPressedChange={setIsIndexesOpen}
						>
							<Lucide.PanelRightIcon className="w-4 h-4" />
							Indexes{indexes.length > 0 ? ` (${indexes.length})` : ""}
						</HSComp.Toggle>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-3 p-4 grow min-h-0 overflow-auto">
				{shapesQuery.isError && (
					<div className="text-text-danger text-sm">
						{(shapesQuery.error as Error).message}
					</div>
				)}

				{!shapesQuery.isLoading && shapes.length === 0 && (
					<EmptyState
						title="No usage recorded yet"
						description={
							<>
								Issue a few searches that include <code>{code}</code> on{" "}
								<code>{base}</code> and stats will appear here.
							</>
						}
					/>
				)}

				{shapes.length > 0 && (
					<div className="shrink-0 [&_[data-slot=table-container]]:!h-auto">
						<HSComp.Table zebra className="typo-code">
							<HSComp.TableHeader>
								<HSComp.TableRow>
									<HSComp.TableHead className="w-0">
										<span className="sr-only">Actions</span>
									</HSComp.TableHead>
									<HSComp.TableHead>Search Parameters</HSComp.TableHead>
									<HSComp.TableHead className="w-0 text-right">
										Calls
									</HSComp.TableHead>
									<HSComp.TableHead className="w-0 text-right">
										Mean&nbsp;ms
									</HSComp.TableHead>
									<HSComp.TableHead className="w-0 text-right">
										Min&nbsp;ms
									</HSComp.TableHead>
									<HSComp.TableHead className="w-0 text-right">
										Max&nbsp;ms
									</HSComp.TableHead>
									<HSComp.TableHead className="w-0 text-right">
										Total&nbsp;ms
									</HSComp.TableHead>
									<HSComp.TableHead className="w-0">Last used</HSComp.TableHead>
								</HSComp.TableRow>
							</HSComp.TableHeader>
							<HSComp.TableBody>
								{shapes.map((s, i) => (
									<HSComp.TableRow
										key={s.search_params.join("|")}
										zebra
										index={i}
									>
										<HSComp.TableCell>
											<HSComp.Tooltip>
												<HSComp.TooltipTrigger asChild>
													<HSComp.IconButton
														variant="ghost"
														aria-label={`Reset stats for ${s.search_params.join(", ")}`}
														disabled={resetShapeMutation.isPending}
														icon={<Lucide.RotateCcwIcon className="w-4 h-4" />}
														onClick={() =>
															resetShapeMutation.mutate(s.search_params)
														}
													/>
												</HSComp.TooltipTrigger>
												<HSComp.TooltipContent>
													Reset stats for this combination
												</HSComp.TooltipContent>
											</HSComp.Tooltip>
										</HSComp.TableCell>
										<HSComp.TableCell>
											{renderShapeParams(s.search_params)}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-right tabular-nums">
											{formatCount(s.calls)}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-right tabular-nums">
											{formatMs(s.mean_time_ms)}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-right tabular-nums">
											{formatMs(s.min_time_ms)}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-right tabular-nums">
											{formatMs(s.max_time_ms)}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-right tabular-nums">
											{formatMs(s.total_time_ms)}
										</HSComp.TableCell>
										<HSComp.TableCell
											title={s.last_used_at ?? undefined}
											className="whitespace-nowrap"
										>
											{formatRelativeTime(s.last_used_at)}
										</HSComp.TableCell>
									</HSComp.TableRow>
								))}
							</HSComp.TableBody>
						</HSComp.Table>
					</div>
				)}
			</div>
		</div>
	);

	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="search-parameter-stats-tab"
		>
			<HSComp.ResizablePanel minSize={30}>{statsBody}</HSComp.ResizablePanel>
			{isIndexesOpen && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel defaultSize={35} minSize={20}>
						<IndexesPanel
							client={client}
							resourceType={base}
							searchParam={code}
							existing={indexes}
							existingIsLoading={indexesQuery.isLoading}
							suggestionsQuery={suggestQuery}
							onClose={() => setIsIndexesOpen(false)}
							onReloadSuggest={() => suggestQuery.refetch()}
							onExistingChanged={() =>
								queryClient.invalidateQueries({ queryKey: indexesQueryKey })
							}
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
};
