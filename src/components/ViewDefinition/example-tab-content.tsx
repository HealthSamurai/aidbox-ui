import type {
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	Button,
	CodeEditor,
	CopyIcon,
	SegmentControl,
	Separator,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as yaml from "js-yaml";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContext, useState } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";
import * as Utils from "../../utils";
import * as Constants from "./constants";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import { SearchBar } from "./search-bar";
import type { ViewDefinitionEditorMode } from "./types";

const searchResources = async (
	client: AidboxClientR5,
	resourceType: string,
	searchParams: string,
): Promise<Resource[]> => {
	const result = await client.searchType({
		type: resourceType,
		query: searchParams.trim() ? Utils.formatSearchQuery(searchParams) : [],
	});

	if (result.isErr())
		throw new Error("searchResources error", { cause: result.value.resource });

	const { entry } = result.value.resource;

	if (entry && entry.length > 0) {
		return entry.flatMap((entry: BundleEntry) => entry.resource || []);
	} else {
		return [];
	}
};

const ExampleTabEditorMenu = ({
	mode,
	onModeChange,
	textToCopy,
	onPrevious,
	onNext,
	canGoToPrevious,
	canGoToNext,
}: {
	mode: ViewDefinitionEditorMode;
	onModeChange: (mode: ViewDefinitionEditorMode) => void;
	textToCopy: string;
	onPrevious: () => void;
	onNext: () => void;
	canGoToPrevious: boolean;
	canGoToNext: boolean;
}) => {
	return (
		<div className="flex items-center gap-2 border rounded-full py-2 pr-2 pl-2.5 border-border-secondary bg-bg-primary toolbar-shadow">
			<SegmentControl
				value={mode}
				onValueChange={(value) =>
					onModeChange(value as ViewDefinitionEditorMode)
				}
				items={[
					{ value: "json", label: "JSON" },
					{ value: "yaml", label: "YAML" },
				]}
			/>
			<Button variant="ghost" size="small" asChild>
				<CopyIcon text={textToCopy} />
			</Button>
			<Separator orientation="vertical" className="h-6!" />
			<div className="flex items-center gap-0.5">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="small"
							onClick={onPrevious}
							disabled={!canGoToPrevious}
						>
							<ChevronLeft />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Previous instance</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="small"
							onClick={onNext}
							disabled={!canGoToNext}
						>
							<ChevronRight />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Next instance</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
};

export function ExampleTabContent() {
	const aidboxClient = useAidboxClient();
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);
	const viewDefinitionResourceType =
		viewDefinitionTypeContext.viewDefinitionResourceType;
	const isLoadingViewDef = viewDefinitionContext.isLoadingViewDef;

	const [currentResultIndex, setCurrentResultIndex] = useState(0);
	const [exampleMode, setExampleMode] =
		useLocalStorage<ViewDefinitionEditorMode>({
			key: `viewDefinition-infoPanel-exampleMode`,
			defaultValue: "json",
			getInitialValueInEffect: false,
		});

	const [query, setQuery] = useState("");
	const queryClient = useQueryClient();

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID, query],
		queryFn: async () => {
			if (!viewDefinitionResourceType) return;
			const resources = await searchResources(
				aidboxClient,
				viewDefinitionResourceType,
				query,
			);
			setCurrentResultIndex(0);
			return resources;
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	const handlePrevious = () => {
		if (currentResultIndex > 0 && data && data.length > 0) {
			const newIndex = currentResultIndex - 1;
			setCurrentResultIndex(newIndex);
		}
	};

	const handleNext = () => {
		if (data && currentResultIndex < data.length - 1) {
			const newIndex = currentResultIndex + 1;
			setCurrentResultIndex(newIndex);
		}
	};

	const canGoToPrevious = currentResultIndex > 0;
	const canGoToNext = data ? currentResultIndex < data.length - 1 : false;

	const resourceType = viewDefinitionResourceType || "Patient";
	const exampleResource = data ? data[currentResultIndex] : null;

	const getCopyText = () => {
		return exampleMode === "yaml"
			? yaml.dump(exampleResource, { indent: 2 })
			: JSON.stringify(exampleResource, null, 2);
	};

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<SearchBar
				handleSearch={(q?: string) => {
					setQuery(q || "");
					queryClient.invalidateQueries({
						queryKey: [viewDefinitionResourceType, Constants.PageID, q || ""],
					});
				}}
				isLoadingExample={isLoading}
			/>
			<div className="flex-1 overflow-auto min-h-0">
				{isLoadingViewDef ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Loading examples...</div>
							<div className="text-sm">Fetching {resourceType} examples</div>
						</div>
					</div>
				) : isLoading ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Searching...</div>
							<div className="text-sm">Fetching {resourceType} instances</div>
						</div>
					</div>
				) : (
					<div className="relative h-full w-full">
						{exampleResource ? (
							<>
								<div className="absolute top-2 right-3 z-10">
									<ExampleTabEditorMenu
										mode={exampleMode}
										onModeChange={setExampleMode}
										textToCopy={getCopyText()}
										onPrevious={handlePrevious}
										onNext={handleNext}
										canGoToPrevious={canGoToPrevious}
										canGoToNext={canGoToNext}
									/>
								</div>
								<CodeEditor
									readOnly
									currentValue={
										exampleMode === "yaml"
											? yaml.dump(exampleResource, { indent: 2 })
											: JSON.stringify(exampleResource, null, 2)
									}
									mode={exampleMode}
								/>
							</>
						) : status === "error" ? (
							<>
								<div className="absolute top-2 right-3 z-10">
									<ExampleTabEditorMenu
										mode={exampleMode}
										onModeChange={setExampleMode}
										textToCopy={getCopyText()}
										onPrevious={() => {}}
										onNext={() => {}}
										canGoToPrevious={false}
										canGoToNext={false}
									/>
								</div>
								<CodeEditor
									readOnly
									currentValue={
										exampleMode === "yaml"
											? yaml.dump(error.cause, { indent: 2 })
											: JSON.stringify(error.cause, null, 2)
									}
									mode={exampleMode}
								/>
							</>
						) : (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Resource not found</div>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
