import type { ExternalToast } from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import { createResource, deleteResource, updateResource } from "./api";

const toastPlacement: ExternalToast = {
	position: "bottom-right",
	style: { margin: "1rem" },
};

export const SaveButton = ({
	resourceType,
	id,
	resourceText,
}: {
	resourceType: string;
	id: string | undefined;
	resourceText: string;
}) => {
	const navigate = Router.useNavigate();
	const mutation = useMutation({
		mutationFn: async (value: string) => {
			if (id) return await updateResource(resourceType, id, value);
			return await createResource(resourceType, value);
		},
		onError: (error, _variables, _onMutateResult, _context) => {
			HSComp.toast.error(`Can't save: ${error}`, toastPlacement);
		},
		onSuccess: (resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", toastPlacement);
			if (!id)
				navigate({
					to: `/resource/$resourceType/edit/$id`,
					params: { resourceType, id: resource.id },
					search: { tab: "code" },
				});
		},
	});

	return (
		<HSComp.Button
			variant="secondary"
			onClick={(event) => {
				event.preventDefault();
				mutation.mutate(resourceText);
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
			HSComp.toast.error(`Can't delete: ${error}`, toastPlacement);
		},
		onSuccess: (_resource, _variables, _onMutateResult, _context) => {
			HSComp.toast.success("Saved", toastPlacement);
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
