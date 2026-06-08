import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { cleanEmptyValues } from "../../utils/clean-empty-values";
import { useConceptMapContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import type { ConceptMap } from "./types";

function toOperationOutcome(err: unknown): HSComp.OperationOutcome {
	if (
		typeof err === "object" &&
		err !== null &&
		"resourceType" in err &&
		(err as { resourceType: string }).resourceType === "OperationOutcome"
	) {
		return err as unknown as HSComp.OperationOutcome;
	}
	return {
		resourceType: "OperationOutcome",
		issue: [
			{
				severity: "error",
				code: "exception",
				diagnostics: err instanceof Error ? err.message : String(err),
			},
		],
	};
}

export const ConceptMapBuilderContent = () => {
	const client = useAidboxClient();
	const { conceptMap } = useConceptMapContext();

	const saveMutation = useMutation({
		mutationFn: async () => {
			const payload = cleanEmptyValues(conceptMap);
			if (payload.id) {
				const result = await client.request<ConceptMap>({
					method: "PUT",
					url: `/fhir/ConceptMap/${payload.id}`,
					body: JSON.stringify(payload),
					headers: { "Content-Type": "application/json" },
				});
				if (result.isErr()) throw result.value.resource;
				return result.value.resource;
			}
			const result = await client.request<ConceptMap>({
				method: "POST",
				url: "/fhir/ConceptMap",
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: () => {
			HSComp.toast.success("ConceptMap saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: (err) => {
			const oo = toOperationOutcome(err);
			Utils.toastError(
				"Failed to save ConceptMap",
				oo.issue?.[0]?.diagnostics ?? undefined,
			);
		},
	});

	return (
		<div className="relative h-full grow min-h-0 flex flex-col">
			<div className="flex flex-col h-full">
				<EditorHeaderMenu
					onSave={() => saveMutation.mutate()}
					isSaveDisabled={saveMutation.isPending}
				/>
				<div className="flex-1 min-h-0 overflow-auto">
					<div className="min-h-full bg-bg-primary px-2.5 pt-3 pb-[250px]">
						<PropertiesTree />
					</div>
				</div>
			</div>
		</div>
	);
};
