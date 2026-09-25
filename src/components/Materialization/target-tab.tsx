import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { EmptyState } from "../empty-state";
import { fetchResource } from "../ResourceEditor/api";
import { pageId } from "../ResourceEditor/types";
import { useMaterializations } from "./api";
import {
	MaterializationStatusGrid,
	materializationColumns,
} from "./status-grid";

type TargetResource = Resource & { url?: string; name?: string };

/** A plain SQL identifier derived from the target, as a starting object name. */
const suggestObjectName = (resource: TargetResource): string => {
	const base = resource.name || resource.id || "materialized";
	const cleaned = base.replace(/[^A-Za-z0-9_]/g, "_");
	return /^[A-Za-z_]/.test(cleaned) ? cleaned : `m_${cleaned}`;
};

/**
 * Materializations of this ViewDefinition or Library, with a way to create the
 * first one. Materializations point at a canonical, so the target needs a url.
 */
export const MaterializationsTab = ({
	resource,
	resourceType,
}: {
	resource: Resource;
	resourceType: string;
}) => {
	const navigate = useNavigate();
	const client = useAidboxClient();
	const passed = resource as TargetResource;
	// The builders keep their own copy of the resource and save from it, so the
	// one handed down here can predate the last save. Read it from the page's
	// own cache instead, which those saves invalidate.
	const { data: fetched } = useQuery({
		queryKey: [pageId, resourceType, passed.id],
		queryFn: () => fetchResource(client, resourceType, passed.id as string),
		enabled: Boolean(passed.id),
	});
	const target = (fetched as TargetResource) ?? passed;
	const { data: rows = [], isLoading, error } = useMaterializations(target.url);

	const onCreate = () => {
		if (!target.url) {
			Utils.toastError(
				"Cannot materialize without a url",
				`A Materialization points at a canonical url, and this ${resourceType} has none. Set url first, save, then create the Materialization.`,
			);
			return;
		}
		navigate({
			to: "/resource/$resourceType/create",
			params: { resourceType: "AidboxMaterialization" },
			search: {
				tab: "builder" as const,
				mode: "json" as const,
				builderTab: "form" as const,
				target: target.url,
				targetType:
					resourceType === "ViewDefinition" ? "ViewDefinition" : "Library",
				objectName: suggestObjectName(target),
			},
		});
	};

	return (
		<MaterializationStatusGrid
			rows={rows}
			columns={materializationColumns}
			loading={isLoading}
			error={error}
			emptyState={
				<EmptyState
					grayscale
					title="No Materializations"
					description={`Persist this ${resourceType} as a PostgreSQL view`}
					action={
						<HSComp.Button variant="secondary" onClick={onCreate}>
							<Lucide.PlusIcon className="size-4 text-text-info-primary" />
							Create Materialization
						</HSComp.Button>
					}
				/>
			}
		/>
	);
};
