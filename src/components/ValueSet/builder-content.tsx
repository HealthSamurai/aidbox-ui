import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { PanelBottomOpen } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks";
import { cleanEmptyValues } from "../../utils/clean-empty-values";
import { addUrlToHistory } from "../../utils/url-history";
import { useValueSetContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import { ResultPanel } from "./result-panel";
import type { ValueSet } from "./types";

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "valueset-builder:result-page-size";

type ExpandVariables = {
	offset: number;
	count: number;
	reset: boolean;
	seq: number;
};

function toOperationOutcome(err: unknown): HSComp.OperationOutcome {
	if (
		typeof err === "object" &&
		err !== null &&
		"resourceType" in err &&
		(err as { resourceType: string }).resourceType === "OperationOutcome"
	) {
		return err as unknown as HSComp.OperationOutcome;
	}
	return {
		resourceType: "OperationOutcome",
		issue: [
			{
				severity: "error",
				code: "exception",
				diagnostics: err instanceof Error ? err.message : String(err),
			},
		],
	};
}

export const ValueSetBuilderContent = () => {
	const client = useAidboxClient();
	const {
		valueSet,
		setExpansion,
		setExpandError,
		isExpanding,
		setIsExpanding,
		expansion,
		expandError,
		setExpandDurationMs,
		setMissingFields,
		setIsDirty,
	} = useValueSetContext();

	const saveMutation = useMutation({
		mutationFn: async () => {
			const missing = new Set<string>();
			if (!valueSet.status) missing.add("status");
			if (missing.size > 0) {
				setMissingFields(missing);
				throw {
					resourceType: "OperationOutcome",
					issue: [
						{
							severity: "error",
							code: "required",
							diagnostics: `Missing required field${missing.size > 1 ? "s" : ""}: ${[...missing].join(", ")}`,
						},
					],
				};
			}
			setMissingFields(new Set());
			const payload = cleanEmptyValues(valueSet);
			if (payload.id) {
				const result = await client.request<ValueSet>({
					method: "PUT",
					url: `/fhir/ValueSet/${payload.id}`,
					body: JSON.stringify(payload),
					headers: { "Content-Type": "application/json" },
				});
				if (result.isErr()) throw result.value.resource;
				return result.value.resource;
			}
			const result = await client.request<ValueSet>({
				method: "POST",
				url: "/fhir/ValueSet",
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: () => {
			addUrlToHistory("valueset-builder:url-history", valueSet.url);
			setIsDirty(false);
			HSComp.toast.success("ValueSet saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: (err) => {
			const oo = toOperationOutcome(err);
			Utils.toastError(
				"Failed to save ValueSet",
				oo.issue?.[0]?.diagnostics ?? undefined,
			);
		},
	});

	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: PAGE_SIZE_STORAGE_KEY,
		defaultValue: DEFAULT_PAGE_SIZE,
		getInitialValueInEffect: false,
	});

	const expandStartRef = React.useRef<number>(0);
	const expandedValueSetRef = React.useRef<ValueSet | null>(null);
	const expandSeqRef = React.useRef(0);
	const expandMutation = useMutation({
		mutationFn: async ({ offset, count, reset }: ExpandVariables) => {
			setExpandError(null);
			if (reset) {
				setExpansion(null);
				setExpandDurationMs(null);
				expandedValueSetRef.current = cleanEmptyValues(valueSet);
			}
			setIsExpanding(true);
			expandStartRef.current = performance.now();
			const body = {
				resourceType: "Parameters" as const,
				parameter: [
					{
						name: "valueSet",
						resource: expandedValueSetRef.current ?? cleanEmptyValues(valueSet),
					},
					{ name: "count", valueInteger: count },
					{ name: "offset", valueInteger: offset },
				],
			};
			const result = await client.request<ValueSet>({
				method: "POST",
				url: "/fhir/ValueSet/$expand",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/fhir+json" },
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: (resource, { seq }) => {
			if (seq !== expandSeqRef.current) return;
			setIsExpanding(false);
			setExpandDurationMs(performance.now() - expandStartRef.current);
			setExpansion(resource.expansion ?? null);
		},
		onError: (err, { seq }) => {
			if (seq !== expandSeqRef.current) return;
			setIsExpanding(false);
			setExpandDurationMs(performance.now() - expandStartRef.current);
			setExpandError(toOperationOutcome(err));
		},
	});

	const [isResultCollapsed, setIsResultCollapsed] = useLocalStorage<boolean>({
		key: "valueset-builder:result-collapsed",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [isMaximized, setIsMaximized] = React.useState(false);

	const handleToggleCollapse = React.useCallback(() => {
		setIsResultCollapsed((prev) => !prev);
		setIsMaximized(false);
	}, [setIsResultCollapsed]);

	const handleToggleMaximize = React.useCallback(() => {
		setIsMaximized((prev) => !prev);
	}, []);

	const handleExpandResult = React.useCallback(() => {
		setIsResultCollapsed(false);
	}, [setIsResultCollapsed]);

	React.useEffect(() => {
		if (!isMaximized) return;
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [isMaximized]);

	const requestExpand = React.useCallback(
		(vars: Omit<ExpandVariables, "seq">) => {
			expandSeqRef.current += 1;
			expandMutation.mutate({ ...vars, seq: expandSeqRef.current });
		},
		[expandMutation],
	);

	const triggerExpand = React.useCallback(() => {
		if (expandMutation.isPending) return;
		handleExpandResult();
		setPage(1);
		requestExpand({ offset: 0, count: pageSize, reset: true });
	}, [expandMutation.isPending, handleExpandResult, requestExpand, pageSize]);

	const handlePageChange = React.useCallback(
		(nextPage: number) => {
			setPage(nextPage);
			requestExpand({
				offset: (nextPage - 1) * pageSize,
				count: pageSize,
				reset: false,
			});
		},
		[requestExpand, pageSize],
	);

	const handlePageSizeChange = React.useCallback(
		(nextSize: number) => {
			setPageSize(nextSize);
			setPage(1);
			requestExpand({ offset: 0, count: nextSize, reset: false });
		},
		[requestExpand, setPageSize],
	);

	const editorContent = (
		<div className="flex flex-col h-full">
			<EditorHeaderMenu
				onExpand={triggerExpand}
				onSave={() => saveMutation.mutate()}
				isExpandDisabled={expandMutation.isPending}
				isSaveDisabled={saveMutation.isPending}
			/>
			<div className="flex-1 min-h-0 overflow-auto">
				<div className="min-h-full bg-bg-primary px-2.5 pt-3 pb-[250px]">
					<PropertiesTree />
				</div>
			</div>
		</div>
	);

	const hasResult = expansion !== null || isExpanding || expandError !== null;

	if (!hasResult) {
		return (
			<div className="relative h-full grow min-h-0 flex flex-col">
				{editorContent}
			</div>
		);
	}

	if (isResultCollapsed) {
		return (
			<div className="relative h-full grow min-h-0 flex flex-col overflow-hidden">
				<div className="flex-1 min-h-0">{editorContent}</div>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-t h-10 flex-none">
					<span className="typo-label text-text-secondary">Expansion</span>
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={handleToggleCollapse}
							>
								<PanelBottomOpen className="w-4 h-4" />
							</HSComp.Button>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent align="end">Restore</HSComp.TooltipContent>
					</HSComp.Tooltip>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-full grow min-h-0 flex flex-col overflow-hidden">
			<HSComp.ResizablePanelGroup
				direction="vertical"
				autoSaveId="valueset-builder-vertical"
				className="grow min-h-0"
			>
				<HSComp.ResizablePanel minSize={20}>
					{editorContent}
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle />
				<HSComp.ResizablePanel defaultSize={30} minSize={10}>
					<div
						className={`flex flex-col h-full ${isMaximized ? "absolute top-0 bottom-0 h-full w-full left-0 z-30 overflow-auto bg-bg-primary" : ""}`}
					>
						<div className="flex-1 min-h-0">
							<ResultPanel
								isMaximized={isMaximized}
								onToggleMaximize={handleToggleMaximize}
								onToggleCollapse={handleToggleCollapse}
								page={page}
								pageSize={pageSize}
								onPageChange={handlePageChange}
								onPageSizeChange={handlePageSizeChange}
							/>
						</div>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
};
