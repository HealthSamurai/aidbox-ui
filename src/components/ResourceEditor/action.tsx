import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
import * as Lucide from "lucide-react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { createResource, deleteResource, updateResource } from "./api";
import type { EditorMode } from "./types";

export const SaveButton = ({
	resourceType,
	id,
	resource,
	mode,
	client,
	onError,
}: {
	resourceType: string;
	id: string | undefined;
	resource: string;
	mode: EditorMode;
	client: AidboxClientR5;
	onError?: (error: Error) => void;
}) => {
	const navigate = Router.useNavigate();
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
			if (!resource.id)
				return Utils.toastError(
					"Failed to open saved resource",
					"resource is missing an ID field",
				);
			if (!id)
				navigate({
					to: `/resource/$resourceType/edit/$id`,
					params: { resourceType, id: resource.id },
					search: { tab: "code", mode: "json" },
				});
		},
	});

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
}: {
	resourceType: string;
	id: string;
	client: AidboxClientR5;
}) => {
	const navigate = Router.useNavigate();
	const mutation = useMutation({
		mutationFn: async () => {
			return await deleteResource(client, resourceType, id);
		},
		onError: Utils.onMutationError,
		onSuccess: (_resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
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
