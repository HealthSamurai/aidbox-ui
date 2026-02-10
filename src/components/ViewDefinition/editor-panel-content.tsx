import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuIcon,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks";
import { CodeTabContent } from "./editor-code-tab-content";
import { FormTabContent } from "./editor-form-tab-content";
import { InfoPanel } from "./info-panel";
import { ViewDefinitionContext } from "./page";
import { ResultPanel } from "./result-panel-content";
import { SQLTab } from "./sql-tab-content";
import type * as Types from "./types";

const cleanEmptyValues = <T,>(obj: T): T => {
	if (Array.isArray(obj)) {
		const cleanedArray = obj
			.map((item) => cleanEmptyValues(item))
			.filter((item) => {
				if (item === null || item === undefined) return false;
				if (typeof item === "string" && item === "") return false;
				if (Array.isArray(item) && item.length === 0) return false;
				if (
					typeof item === "object" &&
					!Array.isArray(item) &&
					Object.keys(item).length === 0
				)
					return false;
				return true;
			});
		return cleanedArray as T;
	}

	if (obj !== null && typeof obj === "object") {
		const cleanedObj: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleanedValue = cleanEmptyValues(value);
			if (cleanedValue === null || cleanedValue === undefined) continue;
			if (typeof cleanedValue === "string" && cleanedValue === "") continue;
			if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
			if (
				typeof cleanedValue === "object" &&
				!Array.isArray(cleanedValue) &&
				Object.keys(cleanedValue).length === 0
			)
				continue;
			cleanedObj[key] = cleanedValue;
		}
		return cleanedObj as T;
	}

	return obj;
};

type ToolbarMode = "full" | "icons" | "collapsed";

const useToolbarMode = (
	ref: React.RefObject<HTMLDivElement | null>,
): ToolbarMode => {
	const [mode, setMode] = React.useState<ToolbarMode>("full");

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0].contentRect.width;
			if (width >= 670) setMode("full");
			else if (width >= 420) setMode("icons");
			else setMode("collapsed");
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);

	return mode;
};

export const EditorHeaderMenu = ({
	onSave,
	onRun,
	onMaterialize,
	onTogglePreview,
	isPreviewOpen,
}: {
	onSave: () => void;
	onRun: () => void;
	onMaterialize: (type: "view" | "materialized-view" | "table") => void;
	onTogglePreview: () => void;
	isPreviewOpen: boolean;
}) => {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const mode = useToolbarMode(containerRef);

	return (
		<div
			ref={containerRef}
			className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b"
		>
			<HSComp.TabsList className="py-0! border-b-0! pr-0!">
				<HSComp.TabsTrigger value="form">Builder</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="code">Code</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
			</HSComp.TabsList>

			{mode === "collapsed" ? (
				<div className="flex items-center gap-1 px-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<HSComp.IconButton
								variant="ghost"
								aria-label="More actions"
								icon={<Lucide.EllipsisIcon className="w-4 h-4" />}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={onRun} className="text-text-link!">
								RUN
								<DropdownMenuIcon>
									<Lucide.PlayIcon className="fill-current text-text-link" />
								</DropdownMenuIcon>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onSave}>
								Save
								<DropdownMenuIcon>
									<Lucide.SaveIcon />
								</DropdownMenuIcon>
							</DropdownMenuItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>Materialize</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem onSelect={() => onMaterialize("view")}>
										View
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() => onMaterialize("materialized-view")}
									>
										Materialized View
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => onMaterialize("table")}>
										Table
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuContent>
					</DropdownMenu>
					<HSComp.Toggle
						variant="outline"
						pressed={isPreviewOpen}
						onPressedChange={onTogglePreview}
					>
						<Lucide.PanelRightIcon className="w-4 h-4" />
					</HSComp.Toggle>
				</div>
			) : (
				<div className="flex items-center gap-4 px-4">
					<Tooltip disableHoverableContent={mode === "full"}>
						<DropdownMenu>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<HSComp.Button variant="link" size="small" className="px-0!">
										<Lucide.DatabaseIcon className="w-4 h-4" />
										{mode === "full" && "Materialize"}
										<Lucide.ChevronDownIcon className="w-4 h-4" />
									</HSComp.Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							{mode !== "full" && <TooltipContent>Materialize</TooltipContent>}
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => onMaterialize("view")}>
									View
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => onMaterialize("materialized-view")}
								>
									Materialized View
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => onMaterialize("table")}>
									Table
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</Tooltip>
					<HSComp.Separator orientation="vertical" className="h-6!" />
					<Tooltip disableHoverableContent={mode === "full"}>
						<TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								className="px-0!"
								onClick={onSave}
							>
								<Lucide.SaveIcon className="w-4 h-4" />
								{mode === "full" && "Save"}
							</HSComp.Button>
						</TooltipTrigger>
						{mode !== "full" && <TooltipContent>Save</TooltipContent>}
					</Tooltip>
					<HSComp.Separator orientation="vertical" className="h-6!" />
					<Tooltip disableHoverableContent={mode === "full"}>
						<TooltipTrigger asChild>
							<HSComp.Button
								variant="link"
								size="small"
								className="px-0! text-text-link! hover:text-text-link/80!"
								onClick={onRun}
							>
								<Lucide.PlayIcon className="w-4 h-4 fill-current" />
								{mode === "full" && "RUN"}
							</HSComp.Button>
						</TooltipTrigger>
						{mode !== "full" && <TooltipContent>Run</TooltipContent>}
					</Tooltip>
					<HSComp.Separator orientation="vertical" className="h-6!" />
					<Tooltip disableHoverableContent={mode === "full"}>
						<TooltipTrigger asChild>
							<HSComp.Toggle
								variant="outline"
								pressed={isPreviewOpen}
								onPressedChange={onTogglePreview}
							>
								<Lucide.PanelRightIcon className="w-4 h-4" />
								{mode === "full" && "Instances"}
							</HSComp.Toggle>
						</TooltipTrigger>
						{mode !== "full" && <TooltipContent>Instances</TooltipContent>}
					</Tooltip>
				</div>
			)}
		</div>
	);
};

type RunResult = {
	contentType: string;
	data: string;
};

export const useViewDefinitionActions = (client: AidboxClientR5) => {
	const navigate = useNavigate({ from: "/resource/$resourceType/create" });
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResource = viewDefinitionContext.viewDefinition;

	const viewDefinitionMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			if (viewDefinitionContext.originalId)
				return client.update({
					type: "ViewDefinition",
					id: viewDefinitionContext.originalId,
					resource: viewDefinition,
				});
			throw Error("missing originalId in the ViewDefinitionContext");
		},
		onSuccess: (result) => {
			if (result.isErr()) {
				viewDefinitionContext.setRunError(result.value.resource);
				return;
			}

			viewDefinitionContext.setRunError(undefined);
			viewDefinitionContext.setIsDirty(false);
			HSComp.toast.success("ViewDefinition saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionCreateMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			return client.create<ViewDefinition>({
				type: "ViewDefinition",
				resource: viewDefinition,
			});
		},
		onSuccess: (result) => {
			if (result.isErr()) {
				viewDefinitionContext.setRunError(result.value.resource);
				return;
			}

			viewDefinitionContext.setRunError(undefined);
			viewDefinitionContext.setIsDirty(false);
			const id = result.value.resource.id;
			if (!id)
				return Utils.toastError(
					"Error saving ViewDefinition",
					"Missing an ID field in response",
				);

			navigate({
				to: "/resource/$resourceType/edit/$id",
				params: { resourceType: "ViewDefinition", id: id },
				search: { tab: "edit", mode: "json" },
			});
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionRunMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			viewDefinitionContext.setRunError(undefined);
			viewDefinitionContext.setRunResultPage(1);
			viewDefinitionContext.setRunViewDefinition(viewDefinition);

			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{
						name: "viewResource",
						resource: viewDefinition,
					},
					{
						name: "_format",
						valueCode: "json",
					},
					{
						name: "_limit",
						valueInteger: viewDefinitionContext.runResultPageSize,
					},
					{
						name: "_page",
						valueInteger: 1,
					},
				],
			};
			return client.request<RunResult>({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: async (result) => {
			if (result.isErr()) {
				const resource = result.value.resource;
				if (resource.issue?.length) {
					viewDefinitionContext.setRunError({
						resourceType: "OperationOutcome",
						issue: resource.issue.map((issue) => ({
							code: issue.code,
							severity: issue.severity as
								| "fatal"
								| "error"
								| "warning"
								| "information",
							diagnostics: issue.diagnostics,
							details: issue.details,
							expression: issue.expression?.map((e) =>
								e.replace(
									/^Parameters\.parameter\[\d+\]\.resource\./,
									"ViewDefinition.",
								),
							),
						})),
					});
				} else {
					for (const issue of issues) {
						Utils.toastError(
							issue.expression.replace(
								/^Parameters\.parameter\[\d+\]\.resource\./,
								"ViewDefinition.",
							),
							issue.diagnostics,
						);
					}
				}
			} else {
				viewDefinitionContext.setRunError(undefined);
				const { data } = result.value.resource;
				const decodedData = atob(data);
				viewDefinitionContext.setRunResult(decodedData);
				HSComp.toast.success("ViewDefinition run successfully", {
					position: "bottom-right",
					style: { margin: "1rem" },
				});
			}
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionMaterializeMutation = useMutation({
		mutationFn: ({
			viewDefinition,
			materializeType,
		}: {
			viewDefinition: ViewDefinition;
			materializeType: "view" | "materialized-view" | "table";
		}) => {
			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{
						name: "type",
						valueCode: materializeType,
					},
					{
						name: "viewResource",
						resource: viewDefinition,
					},
				],
			};
			return client.rawRequest({
				method: "POST",
				url: "/fhir/ViewDefinition/$materialize",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: async (data) => {
			const response = await data.response.json();
			const viewName =
				response.parameter?.find((p: { name: string }) => p.name === "viewName")
					?.valueString || "unknown";
			HSComp.toast.success(
				<div className="flex items-center gap-2">
					<span>Materialized: {viewName}</span>
					<HSComp.IconButton
						variant="ghost"
						aria-label="Copy view name"
						icon={<Lucide.CopyIcon className="w-4 h-4" />}
						onClick={() => {
							navigator.clipboard.writeText(viewName);
							HSComp.toast.success("Copied to clipboard", {
								position: "bottom-right",
								style: { margin: "1rem" },
							});
						}}
					/>
				</div>,
				{
					position: "bottom-right",
					style: { margin: "1rem" },
				},
			);
		},
		onError: Utils.onError,
	});

	const viewDefinitionDeleteMutation = useMutation({
		mutationFn: () => {
			if (!viewDefinitionContext.originalId)
				throw Error("can't delete without ID");

			return client.delete({
				type: "ViewDefinition",
				id: viewDefinitionContext.originalId,
			});
		},
		onSuccess: () => {
			viewDefinitionContext.setIsDirty(false);
			HSComp.toast.success("ViewDefinition deleted successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType: "ViewDefinition" },
			});
		},
		onError: Utils.onError,
	});

	const handleSave = () => {
		if (viewDefinitionResource) {
			const cleanedViewDefinition = cleanEmptyValues(viewDefinitionResource);
			if (viewDefinitionContext.originalId) {
				viewDefinitionMutation.mutate(cleanedViewDefinition);
			} else {
				viewDefinitionCreateMutation.mutate(cleanedViewDefinition);
			}
		}
	};

	const handleRun = () => {
		if (viewDefinitionResource) {
			viewDefinitionRunMutation.mutate(
				cleanEmptyValues(viewDefinitionResource),
			);
		}
	};

	const handleMaterialize = (
		materializeType: "view" | "materialized-view" | "table",
	) => {
		if (viewDefinitionResource) {
			viewDefinitionMaterializeMutation.mutate({
				viewDefinition: viewDefinitionResource,
				materializeType,
			});
		}
	};

	const handleDelete = () => {
		viewDefinitionDeleteMutation.mutate();
	};

	return { handleSave, handleRun, handleMaterialize, handleDelete };
};

export const EditorPanelContent = ({
	isPreviewOpen,
	onTogglePreview,
}: {
	isPreviewOpen: boolean;
	onTogglePreview: () => void;
}) => {
	const aidboxClient: AidboxClientR5 = useAidboxClient();
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const { handleSave, handleRun, handleMaterialize } =
		useViewDefinitionActions(aidboxClient);

	const navigate = useNavigate();

	const createSearch = useSearch({
		from: "/resource/$resourceType/create",
		shouldThrow: false,
	});
	const editSearch = useSearch({
		from: "/resource/$resourceType/edit/$id",
		shouldThrow: false,
	});
	const search = createSearch || editSearch;
	if (search === undefined) {
		console.error("createSearch and editSearch are undefined");
		return <div>FAILED DUE TO UNDEFINED SEARCH</div>;
	}
	const { builderTab: selectedTab } = search;

	const handleOnTabSelect = (value: Types.ViewDefinitionEditorTab) => {
		navigate({
			from:
				createSearch !== undefined
					? "/resource/$resourceType/create"
					: "/resource/$resourceType/edit/$id",
			search: (prev: Record<string, unknown>) => ({
				...prev,
				builderTab: value,
			}),
		});
	};

	return (
		<HSComp.ResizablePanelGroup direction="vertical" className="grow min-h-0">
			<HSComp.ResizablePanel minSize={20}>
				<HSComp.Tabs
					variant="tertiary"
					defaultValue={selectedTab}
					onValueChange={handleOnTabSelect}
					className="h-full"
				>
					<EditorHeaderMenu
						onSave={handleSave}
						onRun={handleRun}
						onMaterialize={handleMaterialize}
						onTogglePreview={onTogglePreview}
						isPreviewOpen={isPreviewOpen}
					/>
					<HSComp.TabsContent
						value={"form"}
						className={`data-[state=inactive]:hidden ${isPreviewOpen ? "" : "bg-bg-tertiary"}`}
						forceMount
					>
						{isPreviewOpen ? (
							<div className="px-2.5 py-1">
								<FormTabContent />
							</div>
						) : (
							<div className="mx-auto max-w-[687px] min-h-full bg-bg-primary border-x border-border-secondary px-2.5 py-3">
								<FormTabContent />
							</div>
						)}
					</HSComp.TabsContent>
					<HSComp.TabsContent value={"code"} className="overflow-hidden!">
						<CodeTabContent />
					</HSComp.TabsContent>
					<HSComp.TabsContent value={"sql"}>
						<SQLTab />
					</HSComp.TabsContent>
				</HSComp.Tabs>
			</HSComp.ResizablePanel>
			{viewDefinitionContext.runError && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel defaultSize={30} minSize={10}>
						<HSComp.OperationOutcomeView
							resource={viewDefinitionContext.runError}
							onIssueClick={(issue) =>
								viewDefinitionContext.issueClickRef.current?.(issue)
							}
							className="h-full overflow-auto"
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
};

export const BuilderContent = () => {
	const [isPreviewOpen, setIsPreviewOpen] = useLocalStorage<boolean>({
		key: "viewDefinition-instancePreviewOpen",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [isResultCollapsed, setIsResultCollapsed] = useLocalStorage<boolean>({
		key: "viewDefinition-resultCollapsed",
		defaultValue: false,
		getInitialValueInEffect: false,
	});

	const handleTogglePreview = () => {
		setIsPreviewOpen((prev) => !prev);
	};

	React.useEffect(() => {
		if (!isPreviewOpen) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsPreviewOpen(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isPreviewOpen, setIsPreviewOpen]);

	const handleToggleResultCollapse = () => {
		setIsResultCollapsed((prev) => !prev);
	};

	if (isResultCollapsed) {
		return (
			<div className="relative h-full flex flex-col">
				<div className="flex-1 min-h-0 overflow-hidden">
					<HSComp.ResizablePanelGroup
						direction="horizontal"
						autoSaveId="view-definition-horizontal-panel"
					>
						<HSComp.ResizablePanel minSize={20}>
							<EditorPanelContent
								isPreviewOpen={isPreviewOpen}
								onTogglePreview={handleTogglePreview}
							/>
						</HSComp.ResizablePanel>
						{isPreviewOpen && (
							<>
								<HSComp.ResizableHandle />
								<HSComp.ResizablePanel minSize={20}>
									<InfoPanel onClose={handleTogglePreview} />
								</HSComp.ResizablePanel>
							</>
						)}
					</HSComp.ResizablePanelGroup>
				</div>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-t h-10 flex-none">
					<span className="typo-label text-text-secondary">Result</span>
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={handleToggleResultCollapse}
							>
								<Lucide.PanelBottomOpen className="w-4 h-4" />
							</HSComp.Button>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent align="end">Restore</HSComp.TooltipContent>
					</HSComp.Tooltip>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-full">
			<HSComp.ResizablePanelGroup
				direction="vertical"
				autoSaveId="view-definition-vertical-panel"
			>
				<HSComp.ResizablePanel minSize={10}>
					<HSComp.ResizablePanelGroup
						direction="horizontal"
						autoSaveId="view-definition-horizontal-panel"
					>
						<HSComp.ResizablePanel minSize={20}>
							<EditorPanelContent
								isPreviewOpen={isPreviewOpen}
								onTogglePreview={handleTogglePreview}
							/>
						</HSComp.ResizablePanel>
						{isPreviewOpen && (
							<>
								<HSComp.ResizableHandle />
								<HSComp.ResizablePanel minSize={20}>
									<InfoPanel onClose={handleTogglePreview} />
								</HSComp.ResizablePanel>
							</>
						)}
					</HSComp.ResizablePanelGroup>
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle />
				<HSComp.ResizablePanel minSize={10}>
					<ResultPanel onToggleCollapse={handleToggleResultCollapse} />
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
};
