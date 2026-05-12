import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { EmptyState } from "../empty-state";
import { formatCount, formatMs, formatRelativeTime } from "./format";
import { rpcCall } from "./suggest-index";
import type { SearchParamShape } from "./types";

const shapeKey = (s: SearchParamShape) => s.search_params.join("|");

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

	const resetShapesMutation = ReactQuery.useMutation({
		mutationFn: async (paramsList: string[][]) => {
			// Backend takes one (rt, search-params) per call; loop client-side.
			// Small N (selection bound by UI), so a sequential loop is fine.
			for (const params of paramsList) {
				await rpcCall(client, "aidbox.index/reset-search-param-stats", {
					"resource-type": base,
					"search-params": params,
				});
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			setSelected(new Set());
		},
		onError: ApiUtils.onMutationError,
	});

	const [selected, setSelected] = React.useState<Set<string>>(new Set());

	if (!base || !code) {
		return (
			<div className="p-4 text-text-secondary text-sm">
				Stats require both <code>base</code> and <code>code</code> on the
				SearchParameter resource.
			</div>
		);
	}

	const shapes = shapesQuery.data ?? [];
	const paramIdByCode = paramsLookupQuery.data ?? {};

	const renderShapeParams = (params: string[]) =>
		params.map((p, i) => {
			// Backend encodes modifiers into the key (`gender:in`); the SP
			// lookup map is keyed on the bare `code`, so split before lookup.
			const colonAt = p.indexOf(":");
			const baseName = colonAt < 0 ? p : p.slice(0, colonAt);
			const id = paramIdByCode[baseName];
			const node = id ? (
				<Router.Link
					to="/resource/$resourceType/edit/$id"
					params={{ resourceType: "SearchParameter", id }}
					search={{
						tab: "builder" as const,
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

	const allKeys = shapes.map(shapeKey);
	const allSelected =
		allKeys.length > 0 && allKeys.every((k) => selected.has(k));
	const someSelected = !allSelected && allKeys.some((k) => selected.has(k));

	const toggleAll = () =>
		setSelected(allSelected ? new Set() : new Set(allKeys));

	const toggleOne = (k: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(k)) next.delete(k);
			else next.add(k);
			return next;
		});

	const selectionCount = selected.size;

	return (
		<div className="flex flex-col h-full">
			<div className="grow min-h-0 overflow-auto">
				{shapesQuery.isError && (
					<div className="p-4 text-text-danger text-sm">
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
					<HSComp.Table zebra stickyHeader className="typo-code">
						<HSComp.TableHeader>
							<HSComp.TableRow>
								<HSComp.TableHead className="w-[52px] min-w-[52px]">
									<HSComp.Checkbox
										size="small"
										className="border-border-primary"
										checked={
											allSelected
												? true
												: someSelected
													? "indeterminate"
													: false
										}
										onCheckedChange={toggleAll}
										aria-label="Select all"
									/>
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
							{shapes.map((s, i) => {
								const k = shapeKey(s);
								const isSelected = selected.has(k);
								return (
									<HSComp.TableRow
										key={k}
										zebra
										index={i}
										selected={isSelected}
									>
										<HSComp.TableCell>
											<HSComp.Checkbox
												size="small"
												className="border-border-primary"
												checked={isSelected}
												onCheckedChange={() => toggleOne(k)}
												aria-label={`Select ${s.search_params.join(", ")}`}
											/>
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
								);
							})}
						</HSComp.TableBody>
					</HSComp.Table>
				)}
			</div>

			{selectionCount > 0 && (
				<div className="flex items-center gap-4 border-t bg-bg-secondary px-4 h-10 shrink-0">
					<span className="typo-default text-text-primary">
						{selectionCount} selected:
					</span>
					<HSComp.Button
						variant="ghost"
						size="small"
						className="text-text-secondary!"
						disabled={resetShapesMutation.isPending}
						onClick={() => {
							const targets = shapes
								.filter((s) => selected.has(shapeKey(s)))
								.map((s) => s.search_params);
							resetShapesMutation.mutate(targets);
						}}
					>
						<Lucide.RotateCcwIcon size={16} />
						Reset selected
					</HSComp.Button>
				</div>
			)}
		</div>
	);
};
