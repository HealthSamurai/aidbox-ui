import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { PanelBottomOpen } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks";
import { useValueSetContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import { ResultPanel } from "./result-panel";
import type { ValueSet } from "./types";

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
			const payload = valueSet;
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

	const expandStartRef = React.useRef<number>(0);
	const expandMutation = useMutation({
		mutationFn: async () => {
			setExpandError(null);
			setExpansion(null);
			setExpandDurationMs(null);
			setIsExpanding(true);
			expandStartRef.current = performance.now();
			const body = {
				resourceType: "Parameters" as const,
				parameter: [{ name: "valueSet", resource: valueSet }],
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
		onSuccess: (resource) => {
			setIsExpanding(false);
			setExpandDurationMs(performance.now() - expandStartRef.current);
			setExpansion(resource.expansion ?? null);
		},
		onError: (err) => {
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

	const triggerExpand = React.useCallback(() => {
		if (expandMutation.isPending) return;
		handleExpandResult();
		expandMutation.mutate();
	}, [expandMutation, handleExpandResult]);

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
							/>
						</div>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
};
