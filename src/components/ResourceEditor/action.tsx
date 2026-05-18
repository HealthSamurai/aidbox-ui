import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
import * as Lucide from "lucide-react";
import type React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { createResource, deleteResource, updateResource } from "./api";
import type { EditorMode } from "./types";
import { defaultTabFor, pageId } from "./types";

const DATA_LINEAGE_SIDEBAR_KEY_BY_RESOURCE_TYPE: Record<string, string> = {
	Library: "data-lineage-sidebar-queries",
	ViewDefinition: "data-lineage-sidebar-views",
};

const invalidateDataLineageSidebar = (
	queryClient: ReturnType<typeof useQueryClient>,
	resourceType: string,
) => {
	const key = DATA_LINEAGE_SIDEBAR_KEY_BY_RESOURCE_TYPE[resourceType];
	if (key) queryClient.invalidateQueries({ queryKey: [key] });
};

export interface SaveHandle {
	save: () => Promise<Resource>;
}

export const SaveButton = ({
	resourceType,
	id,
	resource,
	mode,
	client,
	onError,
	onSuccess,
	onCreated,
	saveRef,
}: {
	resourceType: string;
	id: string | undefined;
	resource: string;
	mode: EditorMode;
	client: AidboxClientR5;
	onError?: (error: Error) => void;
	onSuccess?: () => void;
	onCreated?: (id: string) => void;
	saveRef?: React.RefObject<SaveHandle | null>;
}) => {
	const navigate = Router.useNavigate();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (value: string) => {
			const resource = (
				mode === "json" ? JSON.parse(value) : YAML.load(value)
			) as Resource;
			if (id) return await updateResource(client, resourceType, id, resource);
			return await createResource(client, resourceType, resource);
		},
		onError: onError
			? (_error, _vars, _onMutateResult, _context) => onError(_error)
			: Utils.onMutationError,
		onSuccess: (resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			onSuccess?.();
			queryClient.invalidateQueries({
				queryKey: [pageId, resourceType, id],
			});
			invalidateDataLineageSidebar(queryClient, resourceType);
			if (!resource.id)
				return Utils.toastError(
					"Failed to open saved resource",
					"resource is missing an ID field",
				);
			if (id) return;
			if (onCreated) {
				onCreated(resource.id);
				return;
			}
			navigate({
				to: `/resource/$resourceType/edit/$id`,
				params: { resourceType, id: resource.id },
				search: {
					tab: defaultTabFor(resourceType),
					mode: "json" as const,
					builderTab: "form" as const,
				},
			});
		},
	});

	if (saveRef) {
		saveRef.current = {
			save: () => mutation.mutateAsync(resource),
		};
	}

	return (
		<HSComp.Button
			variant="ghost"
			size="small"
			className="px-0! text-text-link"
			onClick={(event) => {
				event.preventDefault();
				mutation.mutate(resource);
			}}
		>
			<Lucide.SaveIcon className="w-4 h-4" />
			Save
		</HSComp.Button>
	);
};

export const DeleteButton = ({
	resourceType,
	id,
	client,
	onDeleted,
}: {
	resourceType: string;
	id: string;
	client: AidboxClientR5;
	onDeleted?: () => void;
}) => {
	const navigate = Router.useNavigate();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () => {
			return await deleteResource(client, resourceType, id);
		},
		onError: Utils.onMutationError,
		onSuccess: (_resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			invalidateDataLineageSidebar(queryClient, resourceType);
			window.dispatchEvent(new Event("aidbox-resource-deleted"));
			if (onDeleted) {
				onDeleted();
				return;
			}
			navigate({
				to: `/resource/$resourceType`,
				params: { resourceType },
			});
		},
	});

	return (
		<HSComp.AlertDialog>
			<HSComp.AlertDialogTrigger asChild>
				<HSComp.Button variant="ghost" size="small" className="px-0!">
					<Lucide.Trash2Icon className="w-4 h-4" />
					Delete
				</HSComp.Button>
			</HSComp.AlertDialogTrigger>
			<HSComp.AlertDialogContent>
				<HSComp.AlertDialogHeader>
					<HSComp.AlertDialogTitle>
						Delete {resourceType}
					</HSComp.AlertDialogTitle>
				</HSComp.AlertDialogHeader>
				<HSComp.AlertDialogDescription>
					Are you sure you want to delete this {resourceType} ({id})? This
					action cannot be undone.
				</HSComp.AlertDialogDescription>
				<HSComp.AlertDialogFooter>
					<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
					<HSComp.AlertDialogAction danger onClick={() => mutation.mutate()}>
						Delete
					</HSComp.AlertDialogAction>
				</HSComp.AlertDialogFooter>
			</HSComp.AlertDialogContent>
		</HSComp.AlertDialog>
	);
};
