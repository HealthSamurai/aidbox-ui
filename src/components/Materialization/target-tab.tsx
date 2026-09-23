import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useNavigate } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as Utils from "../../api/utils";
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
	const target = resource as TargetResource;
	const { data: rows = [], isLoading } = useMaterializations(target.url);

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
			emptyLabel="No materializations"
			loading={isLoading}
			emptyState={
				<div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
					<span className="typo-body text-text-primary">
						No Materialization exists for this {resourceType}.
					</span>
					<span className="typo-body-xs text-text-secondary max-w-[520px]">
						A Materialization persists this {resourceType} as a PostgreSQL view
						or materialized view, so anything built on it reads the object
						instead of inlining its SQL.
					</span>
					<HSComp.Button variant="primary" size="small" onClick={onCreate}>
						<Lucide.PlusIcon className="w-4 h-4" />
						Create Materialization
					</HSComp.Button>
				</div>
			}
		/>
	);
};
