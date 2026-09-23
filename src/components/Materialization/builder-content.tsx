import type {
	OperationOutcome,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMaterializationRows } from "./api";
import { PropertiesTree } from "./properties-tree";
import { MaterializationStatusGrid } from "./status-grid";
import type { MaterializationResource } from "./types";

export const MaterializationBuilderContent = ({
	resource,
	onResourceChange,
	actions,
	saveError,
}: {
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
	/** Toolbar slot — the Save/Materialize/Delete group from `ResourceEditor`. */
	actions?: React.ReactNode;
	/** OperationOutcome from the last failed save. */
	saveError?: OperationOutcome | null;
}) => {
	const target = (resource as MaterializationResource).target;
	// Only this materialization's own row: the others aimed at the same target
	// are listed on the target's Materializations tab.
	const {
		data: rows = [],
		isLoading,
		isFetching,
		refetch,
	} = useMaterializationRows(target);
	const own = rows.filter((row) => row.id === resource.id);

	return (
		<HSComp.ResizablePanelGroup
			direction="vertical"
			autoSaveId="materialization-builder"
			className="grow min-h-0"
		>
			<HSComp.ResizablePanel minSize={20} className="flex flex-col">
				{actions && (
					<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
						<div className="flex items-center gap-4 px-4 grow">{actions}</div>
					</div>
				)}
				<div className="flex-1 min-h-0 overflow-auto">
					<div className="min-h-full bg-bg-primary px-2.5 pt-3 pb-6">
						<PropertiesTree
							resource={resource}
							onResourceChange={onResourceChange}
						/>
					</div>
				</div>
			</HSComp.ResizablePanel>
			{resource.id && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel defaultSize={35} minSize={10}>
						<MaterializationStatusGrid
							title="Status"
							rows={own}
							loading={isLoading}
							isRefreshing={isFetching}
							onRefresh={() => refetch()}
						/>
					</HSComp.ResizablePanel>
				</>
			)}
			{saveError && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel defaultSize={30} minSize={10}>
						<HSComp.OperationOutcomeView
							resource={saveError as unknown as HSComp.OperationOutcome}
							className="h-full overflow-auto"
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
};
