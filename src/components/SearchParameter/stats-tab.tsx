import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { formatCount, formatMs, formatRelativeTime } from "./format";
import { rpcCall, SuggestIndexButton } from "./suggest-index";
import type { SearchParamShape } from "./types";

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
