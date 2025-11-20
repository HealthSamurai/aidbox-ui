import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
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
}: {
	resourceType: string;
	id: string | undefined;
	resource: string;
	mode: EditorMode;
	client: AidboxClientR5;
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
		onError: Utils.toastAidboxErrorResponse,
		onSuccess: (resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			if (!resource.id) throw new Error("Resource ID is undefined");
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
		onError: Utils.toastAidboxErrorResponse,
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
