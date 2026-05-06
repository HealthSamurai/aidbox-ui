import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { rpcCall, SuggestIndexButton } from "./suggest-index";

type SearchParameterResource = Resource & {
	code?: string;
	base?: string[];
	name?: string;
	description?: string;
};

type ShapeRow = {
	resource_type: string;
	search_params: string[];
	calls: number;
	total_time_ms: number;
	min_time_ms: number | null;
	max_time_ms: number | null;
	mean_time_ms: number;
	last_used_at: string | null;
};

function formatCount(n: number): string {
	return n.toLocaleString();
}

function formatMs(ms: number | null | undefined): string {
	if (ms == null) return "—";
	if (ms < 1) return ms.toFixed(2);
	if (ms < 100) return ms.toFixed(1);
	return Math.round(ms).toString();
}

function formatRelativeTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diff = Date.now() - t;
	const sec = Math.floor(diff / 1000);
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	if (day < 30) return `${day}d ago`;
	return new Date(t).toISOString().slice(0, 10);
}

const StatsTab = ({
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
			return (json.result ?? []) as ShapeRow[];
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

export const SearchParameterBuilderContent = ({
	client,
	resource,
}: {
	client: AidboxClientR5;
	resource: Resource;
}) => {
	const sp = resource as SearchParameterResource;
	const code = sp.code ?? "";
	const base = sp.base?.[0] ?? "";

	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="search-parameter-builder"
			className="grow min-h-0"
		>
			<HSComp.ResizablePanel minSize={30} defaultSize={50}>
				<HSComp.Tabs defaultValue="builder" className="flex flex-col h-full">
					<HSComp.TabsList className="px-4 border-b">
						<HSComp.TabsTrigger value="builder">Builder</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="stats">Stats</HSComp.TabsTrigger>
					</HSComp.TabsList>
					<HSComp.TabsContent
						value="builder"
						className="grow min-h-0 overflow-auto"
					>
						<div className="p-4 text-text-secondary text-sm">
							Form builder — slice B (in progress).
						</div>
					</HSComp.TabsContent>
					<HSComp.TabsContent value="stats" className="grow min-h-0">
						<StatsTab client={client} base={base} code={code} />
					</HSComp.TabsContent>
				</HSComp.Tabs>
			</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel minSize={20} defaultSize={50}>
				<div className="p-4 text-text-secondary text-sm h-full">
					Query runner — slice C.
				</div>
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
};
