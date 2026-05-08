import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { formatCount, formatMs, formatRelativeTime } from "./format";
import { formatStatement, rpcCall, SuggestIndexButton } from "./suggest-index";
import type { SearchParamIndex, SearchParamShape } from "./types";

const IndexCard = ({
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
				<span className="text-xs text-text-secondary font-mono truncate">
					{index.name}
				</span>
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

const IndexesSection = ({
	client,
	resourceType,
	searchParam,
	indexes,
	isLoading,
	onDropped,
}: {
	client: AidboxClientR5;
	resourceType: string;
	searchParam: string;
	indexes: SearchParamIndex[];
	isLoading: boolean;
	onDropped: () => void;
}) => {
	if (isLoading) {
		return <div className="text-sm text-text-secondary">Loading indexes…</div>;
	}
	if (indexes.length === 0) {
		return (
			<div className="text-sm text-text-tertiary">
				No indexes follow the SP-knife naming convention for this search
				parameter.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			{indexes.map((idx) => (
				<IndexCard
					key={idx.name}
					client={client}
					resourceType={resourceType}
					searchParam={searchParam}
					index={idx}
					onDropped={onDropped}
				/>
			))}
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

	const resetMutation = ReactQuery.useMutation({
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
	const totalCalls = shapes.reduce((acc, s) => acc + s.calls, 0);
	const indexes = indexesQuery.data ?? [];

	const statsBody = (
		<div className="flex flex-col gap-3 p-4 h-full overflow-auto">
			<div className="flex items-center gap-2">
				<div className="text-sm text-text-secondary grow">
					{shapesQuery.isLoading
						? "Loading…"
						: `${shapes.length} shape${shapes.length === 1 ? "" : "s"} · ${formatCount(totalCalls)} call${totalCalls === 1 ? "" : "s"}`}
				</div>
				<HSComp.Button
					variant="ghost"
					size="small"
					onClick={() => resetMutation.mutate()}
					disabled={resetMutation.isPending || shapes.length === 0}
				>
					<Lucide.RotateCcwIcon size={14} />
					Reset
				</HSComp.Button>
				<SuggestIndexButton
					client={client}
					resourceType={base}
					searchParam={code}
				/>
				{!isIndexesOpen && (
					<HSComp.Toggle
						variant="outline"
						pressed={isIndexesOpen}
						onPressedChange={setIsIndexesOpen}
					>
						<Lucide.PanelRightIcon className="w-4 h-4" />
						Indexes{indexes.length > 0 ? ` (${indexes.length})` : ""}
					</HSComp.Toggle>
				)}
			</div>

			{shapesQuery.isError && (
				<div className="text-text-danger text-sm">
					{(shapesQuery.error as Error).message}
				</div>
			)}

			{!shapesQuery.isLoading && shapes.length === 0 && (
				<div className="text-text-secondary text-sm">
					No usage recorded yet. Issue a few searches that include{" "}
					<code>{code}</code> on <code>{base}</code> and stats will appear here.
				</div>
			)}

			{shapes.length > 0 && (
				<div className="shrink-0 [&_[data-slot=table-container]]:!h-auto">
					<HSComp.Table zebra className="typo-code">
						<HSComp.TableHeader>
							<HSComp.TableRow>
								<HSComp.TableHead>Shape</HSComp.TableHead>
								<HSComp.TableHead className="w-0 text-right">
									Calls
								</HSComp.TableHead>
								<HSComp.TableHead className="w-0 text-right">
									Mean&nbsp;ms
								</HSComp.TableHead>
								<HSComp.TableHead className="w-0 text-right">
									Min
								</HSComp.TableHead>
								<HSComp.TableHead className="w-0 text-right">
									Max
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
										?{s.search_params.join("&")}
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
	);

	const indexesPanel = (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-4 py-2 border-b border-border-secondary shrink-0">
				<span className="text-sm font-medium text-text-secondary">
					Existing indexes
					{indexes.length > 0 ? ` (${indexes.length})` : ""}
				</span>
				<HSComp.IconButton
					variant="ghost"
					aria-label="Close indexes panel"
					icon={<Lucide.XIcon className="w-4 h-4" />}
					onClick={() => setIsIndexesOpen(false)}
				/>
			</div>
			<div className="flex-1 overflow-auto p-4">
				<IndexesSection
					client={client}
					resourceType={base}
					searchParam={code}
					indexes={indexes}
					isLoading={indexesQuery.isLoading}
					onDropped={() =>
						queryClient.invalidateQueries({ queryKey: indexesQueryKey })
					}
				/>
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
						{indexesPanel}
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
};
