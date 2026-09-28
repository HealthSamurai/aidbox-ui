import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { materializeResource } from "../ResourceEditor/api";
import { materializationsKey, runsKey, searchMaterializations } from "./api";
import { suggestObjectName } from "./types";

/**
 * The Materialize action for the ViewDefinition and SQL builders: with no
 * AidboxMaterialization it offers to create one (and the create page returns
 * here after saving), otherwise it runs. Duplicates targeting one canonical
 * are ambiguous by design, and the run's own refusal is the error to show.
 */
export function useMaterializeAction({
	resourceType,
	resource,
}: {
	resourceType: "ViewDefinition" | "Library";
	/** The resource being built; a Materialization can only target a saved url. */
	resource: { id?: string; url?: string; name?: string } | undefined;
}) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = React.useState(false);

	const materializeMutation = useMutation({
		mutationFn: (id: string) =>
			materializeResource(client, "AidboxMaterialization", id),
		onError: Utils.onMutationError,
		onSuccess: (_data, id) => {
			HSComp.toast.success(
				"Materialization started, it runs in the background",
				defaultToastPlacement,
			);
			queryClient.invalidateQueries({ queryKey: runsKey(id) });
			if (resource?.url)
				queryClient.invalidateQueries({
					queryKey: materializationsKey(resource.url),
				});
		},
	});

	const onMaterialize = async () => {
		if (!resource?.id || !resource.url) {
			Utils.toastError(
				"Cannot materialize without a url",
				`A Materialization points at a canonical url, and this ${resourceType} has none saved. Set url, save, then materialize.`,
			);
			return;
		}
		// Looked up on click rather than kept warm: the answer decides what the
		// button does, so it has to be current.
		try {
			const found = await searchMaterializations(client, resource.url);
			const first = found[0];
			if (!first?.id) {
				setCreateOpen(true);
				return;
			}
			// With duplicates the run is ambiguous whichever id is posted, and the
			// server names them all in its refusal — no client-side choice to make.
			materializeMutation.mutate(first.id);
		} catch (error) {
			Utils.toastError(
				"Could not look up Materializations",
				error instanceof Error ? error.message : String(error),
			);
		}
	};

	const goCreate = () => {
		if (!resource?.id || !resource.url) return;
		navigate({
			to: "/resource/$resourceType/create",
			params: { resourceType: "AidboxMaterialization" },
			search: {
				tab: "builder" as const,
				mode: "json" as const,
				builderTab: "form" as const,
				target: resource.url,
				targetType: resourceType,
				objectName: suggestObjectName(resource),
				returnTo: `${resourceType}/${resource.id}`,
			},
		});
	};

	const dialogs = (
		<ConfirmDialog
			open={createOpen}
			onOpenChange={setCreateOpen}
			title="No Materialization yet"
			description={`Nothing materializes this ${resourceType}. Create an AidboxMaterialization?`}
			confirmLabel="Create"
			onConfirm={goCreate}
		/>
	);

	return {
		onMaterialize,
		dialogs,
		isMaterializing: materializeMutation.isPending,
	};
}
