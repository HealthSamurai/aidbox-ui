import {
	Button,
	CodeEditor,
	CopyIcon,
	SegmentControl,
	SegmentControlItem,
	TabsContent,
} from "@health-samurai/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import * as yaml from "js-yaml";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContext, useState } from "react";
import { AidboxCall } from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import * as Constants from "./constants";
import { ViewDefinitionContext, ViewDefinitionResourceTypeContext } from "./page";
import { SearchBar } from "./search-bar";

const searchResources = async (resourceType: string, searchParams: string): Promise<Record<string, unknown>[]> => {
	const url = searchParams.trim() ? `/fhir/${resourceType}?${searchParams}` : `/fhir/${resourceType}`;

	const response = await AidboxCall<{
		entry?: Array<{ resource: Record<string, unknown> }>;
	}>({
		method: "GET",
		url: url,
		headers: {
			Accept: "application/json",
		},
	});

	if (response?.entry && response.entry.length > 0) {
		return response.entry.map((entry) => entry.resource);
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
	mode: "json" | "yaml";
	onModeChange: (mode: "json" | "yaml") => void;
	textToCopy: string;
	onPrevious: () => void;
	onNext: () => void;
	canGoToPrevious: boolean;
	canGoToNext: boolean;
}) => {
	return (
		<div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
			<SegmentControl
				defaultValue={mode}
				name="example-editor-menu"
				onValueChange={(value) => onModeChange(value as "json" | "yaml")}
			>
				<SegmentControlItem value="json">JSON</SegmentControlItem>
				<SegmentControlItem value="yaml">YAML</SegmentControlItem>
			</SegmentControl>
			<Button variant="ghost" size="small" asChild>
				<CopyIcon text={textToCopy} />
			</Button>
			<div className="border-l h-6" />
			<Button variant="ghost" size="small" onClick={onPrevious} disabled={!canGoToPrevious}>
				<ChevronLeft />
			</Button>
			<Button variant="ghost" size="small" onClick={onNext} disabled={!canGoToNext}>
				<ChevronRight />
			</Button>
		</div>
	);
};

export function ExampleTabContent() {
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const viewDefinitionTypeContext = useContext(ViewDefinitionResourceTypeContext);
	const viewDefinitionResourceType = viewDefinitionTypeContext.viewDefinitionResourceType;
	const isLoadingViewDef = viewDefinitionContext.isLoadingViewDef;

	const [currentResultIndex, setCurrentResultIndex] = useState(0);
	const [exampleMode, setExampleMode] = useLocalStorage<"json" | "yaml">({
		key: `viewDefinition-infoPanel-exampleMode`,
		defaultValue: "json",
	});

	const [query, setQuery] = useState("");
	const queryClient = useQueryClient();

	const { isLoading, data, status, error } = useQuery({
		queryKey: [viewDefinitionResourceType, Constants.PageID, query],
		queryFn: async () => {
			if (!viewDefinitionResourceType) return;
			const resources = await searchResources(viewDefinitionResourceType, query);
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
		<TabsContent value="examples" className="flex flex-col h-full bg-bg-secondary">
			<SearchBar
				handleSearch={(q?: string) => {
					setQuery(q || "");
					queryClient.invalidateQueries({
						queryKey: [viewDefinitionResourceType, Constants.PageID, q || ""],
					});
				}}
				isLoadingExample={isLoading}
			/>
			<div className="flex-1 overflow-auto">
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
							<div>
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
									isReadOnlyTheme={true}
								/>
							</div>
						) : status === "error" ? (
							<div>
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
									isReadOnlyTheme={true}
								/>
							</div>
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
		</TabsContent>
	);
}
