import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
import {
	createResource,
	deleteResource,
	type Resource,
	updateResource,
} from "./api";
import type { EditorMode } from "./types";

export const SaveButton = ({
	resourceType,
	id,
	resource,
	mode,
}: {
	resourceType: string;
	id: string | undefined;
	resource: string;
	mode: EditorMode;
}) => {
	const navigate = Router.useNavigate();
	const mutation = useMutation({
		mutationFn: async (value: string) => {
			const resource = (
				mode === "json" ? JSON.parse(value) : YAML.load(value)
			) as Resource;
			if (id) return await updateResource(resourceType, id, resource);
			return await createResource(resourceType, resource);
		},
		onError: (error, _variables, _onMutateResult, _context) => {
			HSComp.toast.error(`Can't save: ${error}`, defaultToastPlacement);
		},
		onSuccess: (resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
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
			variant="secondary"
			onClick={(event) => {
				event.preventDefault();
				mutation.mutate(resource);
			}}
		>
			Save
		</HSComp.Button>
	);
};

export const DeleteButton = ({
	resourceType,
	id,
}: {
	resourceType: string;
	id: string;
}) => {
	const navigate = Router.useNavigate();
	const mutation = useMutation({
		mutationFn: async () => {
			return await deleteResource(resourceType, id);
		},
		onError: (error, _variables, _onMutateResult, _context) => {
			HSComp.toast.error(`Can't delete: ${error}`, defaultToastPlacement);
		},
		onSuccess: (_resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			navigate({
				to: `/resource/$resourceType`,
				params: { resourceType },
			});
		},
	});

	return (
		<HSComp.Button
			variant="secondary"
			onClick={(event) => {
				event.preventDefault();
				mutation.mutate();
			}}
		>
			Delete
		</HSComp.Button>
	);
};
