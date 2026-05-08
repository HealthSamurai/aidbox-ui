import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { formatCount, formatMs, formatRelativeTime } from "./format";
import { rpcCall, SuggestIndexButton } from "./suggest-index";
import type { SearchParamIndex, SearchParamShape } from "./types";

const IndexesSection = ({
	indexes,
	isLoading,
}: {
	indexes: SearchParamIndex[];
	isLoading: boolean;
}) => {
	if (isLoading) {
		return <div className="text-sm text-text-secondary">Loading indexes…</div>;
	}
	if (indexes.length === 0) {
		return (
			<div className="text-sm text-text-tertiary">
				No Aidbox-managed indexes for this search parameter.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			{indexes.map((idx) => (
				<div
					key={idx.name}
					className="rounded border border-border-secondary overflow-hidden"
				>
					<div className="px-3 py-1.5 text-xs text-text-secondary bg-bg-secondary border-b border-border-secondary font-mono">
						{idx.name}
					</div>
					<div className="h-20 [&_.cm-cursor]:!hidden [&_.cm-content]:!caret-transparent [&_.cm-activeLine]:!bg-transparent">
						<HSComp.CodeEditor
							readOnly
							isReadOnlyTheme
							lineNumbers={false}
							foldGutter={false}
							currentValue={idx.definition}
							mode="sql"
							viewCallback={(view) => {
								view.contentDOM.contentEditable = "false";
							}}
						/>
					</div>
				</div>
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

	return (
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
			</div>

			<div className="flex flex-col gap-2">
				<div className="text-sm font-medium text-text-secondary">
					Existing indexes
				</div>
				<IndexesSection
					indexes={indexesQuery.data ?? []}
					isLoading={indexesQuery.isLoading}
				/>
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
							<HSComp.TableRow key={s.search_params.join("|")} zebra index={i}>
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
			)}
		</div>
	);
};
