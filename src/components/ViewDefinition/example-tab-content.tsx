import {
	Button,
	CodeEditor,
	CopyIcon,
	SegmentControl,
	SegmentControlItem,
	TabsContent,
} from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { AidboxCall } from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import { ViewDefinitionResourceTypeContext } from "./page";
import { SearchBar } from "./search-bar";

const searchResources = async (
	resourceType: string,
	searchParams: string,
): Promise<Record<string, unknown>[]> => {
	const url = searchParams.trim()
		? `/fhir/${resourceType}?${searchParams}`
		: `/fhir/${resourceType}`;

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
			<Button
				variant="ghost"
				size="small"
				onClick={onPrevious}
				disabled={!canGoToPrevious}
			>
				<ChevronLeft />
			</Button>
			<Button
				variant="ghost"
				size="small"
				onClick={onNext}
				disabled={!canGoToNext}
			>
				<ChevronRight />
			</Button>
		</div>
	);
};

export function ExampleTabContent({ activeTab }: { activeTab: string }) {
	const viewDefinitionContext = useContext(ViewDefinitionResourceTypeContext);
	const viewDefinitionResourceType =
		viewDefinitionContext.viewDefinitionResourceType;
	const isLoadingViewDef = viewDefinitionContext.isLoadingViewDef;

	const [exampleResource, setExampleResource] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [isLoadingExample, setIsLoadingExample] = useState(false);
	const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>(
		[],
	);
	const [currentResultIndex, setCurrentResultIndex] = useState(0);
	const [exampleMode, setExampleMode] = useLocalStorage<"json" | "yaml">({
		key: `viewDefinition-infoPanel-exampleMode`,
		defaultValue: "json",
	});

	useEffect(() => {
		if (
			activeTab === "examples" &&
			viewDefinitionResourceType &&
			!exampleResource &&
			!searchResults.length &&
			!isLoadingExample
		) {
			handleSearch("");
		}
	}, [activeTab, viewDefinitionResourceType]);

	const handleSearch = async (query?: string) => {
		if (!viewDefinitionResourceType) return;

		setIsLoadingExample(true);
		try {
			const searchParams = query !== undefined ? query : "";
			const resources = await searchResources(
				viewDefinitionResourceType,
				searchParams,
			);

			if (resources.length > 0) {
				setSearchResults(resources);
				setCurrentResultIndex(0);
				setExampleResource(resources[0] || null);
			} else {
				setSearchResults([]);
				setCurrentResultIndex(0);
				setExampleResource({ message: "No results found" });
			}
		} catch (error) {
			setSearchResults([]);
			setCurrentResultIndex(0);
			setExampleResource({
				error: "Failed to fetch resource",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsLoadingExample(false);
		}
	};

	const handlePrevious = () => {
		if (currentResultIndex > 0 && searchResults.length > 0) {
			const newIndex = currentResultIndex - 1;
			setCurrentResultIndex(newIndex);
			setExampleResource(searchResults[newIndex] || null);
		}
	};

	const handleNext = () => {
		if (currentResultIndex < searchResults.length - 1) {
			const newIndex = currentResultIndex + 1;
			setCurrentResultIndex(newIndex);
			setExampleResource(searchResults[newIndex] || null);
		}
	};

	const canGoToPrevious = currentResultIndex > 0;
	const canGoToNext = currentResultIndex < searchResults.length - 1;

	const resourceType = viewDefinitionResourceType || "Patient";

	const getCopyText = () => {
		if (!exampleResource) {
			const defaultContent = {
				resourceType,
				hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
				examples: ["_id=<resource-id>", "name=<name>", "_count=10"],
			};
			return exampleMode === "yaml"
				? yaml.dump(defaultContent, { indent: 2 })
				: JSON.stringify(defaultContent, null, 2);
		}

		return exampleMode === "yaml"
			? yaml.dump(exampleResource, { indent: 2 })
			: JSON.stringify(exampleResource, null, 2);
	};

	return (
		<TabsContent value="examples" className="flex flex-col h-full">
			<SearchBar
				handleSearch={handleSearch}
				isLoadingExample={isLoadingExample}
			/>
			<div className="flex-1 overflow-auto">
				{isLoadingViewDef ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Loading examples...</div>
							<div className="text-sm">Fetching {resourceType} examples</div>
						</div>
					</div>
				) : isLoadingExample ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Searching...</div>
							<div className="text-sm">Fetching {resourceType} instances</div>
						</div>
					</div>
				) : (
					<div className="relative h-full w-full">
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
								exampleResource
									? exampleMode === "yaml"
										? yaml.dump(exampleResource, { indent: 2 })
										: JSON.stringify(exampleResource, null, 2)
									: exampleMode === "yaml"
										? yaml.dump(
												{
													resourceType,
													hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
													examples: [
														"_id=<resource-id>",
														"name=<name>",
														"_count=10",
													],
												},
												{ indent: 2 },
											)
										: JSON.stringify(
												{
													resourceType,
													hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
													examples: [
														"_id=<resource-id>",
														"name=<name>",
														"_count=10",
													],
												},
												null,
												2,
											)
							}
							mode={exampleMode}
						/>
					</div>
				)}
			</div>
		</TabsContent>
	);
}
