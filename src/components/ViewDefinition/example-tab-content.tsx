import type {
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	Button,
	CodeEditor,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { useContext, useState } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../utils";
import type { ViewDefinitionBuilderActions } from "../../webmcp/view-definition-context";
import { EmptyState } from "../empty-state";
import * as Constants from "./constants";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import { SearchBar } from "./search-bar";

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
	onPrevious,
	onNext,
	canGoToPrevious,
	canGoToNext,
}: {
	onPrevious: () => void;
	onNext: () => void;
	canGoToPrevious: boolean;
	canGoToNext: boolean;
}) => {
	return (
		<div className="flex items-center gap-0.5 border rounded-full py-2 pr-2 pl-2.5 border-border-secondary bg-bg-primary toolbar-shadow">
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
	);
};

export function ExampleTabContent({
	actionsRef,
	instancesQuery,
	onInstancesQueryChange,
}: {
	actionsRef: RefObject<ViewDefinitionBuilderActions | null>;
	instancesQuery: string;
	onInstancesQueryChange: (query: string) => void;
}) {
	const aidboxClient = useAidboxClient();
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);
	const viewDefinitionResourceType =
		viewDefinitionTypeContext.viewDefinitionResourceType;
	const isLoadingViewDef = viewDefinitionContext.isLoadingViewDef;

	const [currentResultIndex, setCurrentResultIndex] = useState(0);

	const query = instancesQuery;
	const setQuery = onInstancesQueryChange;
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

	// Populate instances panel actions on actionsRef
	if (actionsRef.current) {
		actionsRef.current.instancesSearch = (q: string) => {
			setQuery(q);
			queryClient.invalidateQueries({
				queryKey: [viewDefinitionResourceType, Constants.PageID, q],
			});
		};
		actionsRef.current.instancesGetCurrent = () => {
			if (!exampleResource) return null;
			return JSON.stringify(exampleResource, null, 2);
		};
		actionsRef.current.instancesGetCount = () => data?.length ?? 0;
		actionsRef.current.instancesGetIndex = () => currentResultIndex;
		actionsRef.current.instancesNext = handleNext;
		actionsRef.current.instancesPrevious = handlePrevious;
		actionsRef.current.instancesGoToIndex = (index: number) => {
			if (data && index >= 0 && index < data.length) {
				setCurrentResultIndex(index);
			}
		};
	}

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<SearchBar
				value={query}
				onChange={setQuery}
				handleSearch={() => {
					queryClient.invalidateQueries({
						queryKey: [viewDefinitionResourceType, Constants.PageID, query],
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
										onPrevious={handlePrevious}
										onNext={handleNext}
										canGoToPrevious={canGoToPrevious}
										canGoToNext={canGoToNext}
									/>
								</div>
								<CodeEditor
									readOnly
									currentValue={JSON.stringify(exampleResource, null, 2)}
									mode="json"
								/>
							</>
						) : status === "error" ? (
							<>
								<div className="absolute top-2 right-3 z-10">
									<ExampleTabEditorMenu
										onPrevious={() => {}}
										onNext={() => {}}
										canGoToPrevious={false}
										canGoToNext={false}
									/>
								</div>
								<CodeEditor
									readOnly
									currentValue={JSON.stringify(error.cause, null, 2)}
									mode="json"
								/>
							</>
						) : (
							<EmptyState
								title="Resource not found"
								description="If you feel lonely create a new resource"
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
