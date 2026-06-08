import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks";
import { cleanEmptyValues } from "../../utils/clean-empty-values";
import { addUrlToHistory } from "../../utils/url-history";
import { useConceptMapContext } from "./context";
import { EditorHeaderMenu } from "./header-menu";
import { PropertiesTree } from "./properties-tree";
import { TranslatePanel } from "./translate-panel";
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
	const navigate = useNavigate();
	const { conceptMap } = useConceptMapContext();
	const [translateOpen, setTranslateOpen] = useLocalStorage<boolean>({
		key: "conceptMap-translatePanelOpen",
		defaultValue: false,
		getInitialValueInEffect: false,
	});

	const handleToggleTranslate = () => setTranslateOpen((prev) => !prev);

	React.useEffect(() => {
		if (!translateOpen) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setTranslateOpen(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [translateOpen, setTranslateOpen]);

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
		onSuccess: (saved) => {
			addUrlToHistory("conceptmap-builder:url-history", conceptMap.url);
			HSComp.toast.success("ConceptMap saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			// Redirect /create → /edit/{id} after first POST so the URL reflects
			// the freshly created resource (and reloads work).
			if (!conceptMap.id && saved.id) {
				navigate({
					to: "/resource/$resourceType/edit/$id",
					params: { resourceType: "ConceptMap", id: saved.id },
					search: {
						tab: "builder" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					},
				});
			}
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
		<div className="relative h-full grow min-h-0 flex flex-col overflow-hidden">
			<HSComp.ResizablePanelGroup
				direction="horizontal"
				autoSaveId="conceptmap-builder-horizontal"
				className="grow min-h-0"
			>
				<HSComp.ResizablePanel minSize={20}>
					<div className="flex flex-col h-full">
						<EditorHeaderMenu
							onSave={() => saveMutation.mutate()}
							isSaveDisabled={saveMutation.isPending}
							onTranslate={handleToggleTranslate}
							isTranslateActive={translateOpen}
						/>
						<div className="flex-1 min-h-0 overflow-auto">
							<div className="min-h-full bg-bg-primary px-2.5 pt-3 pb-[250px]">
								<PropertiesTree />
							</div>
						</div>
					</div>
				</HSComp.ResizablePanel>
				{translateOpen && (
					<>
						<HSComp.ResizableHandle />
						<HSComp.ResizablePanel minSize={20}>
							<TranslatePanel onClose={() => setTranslateOpen(false)} />
						</HSComp.ResizablePanel>
					</>
				)}
			</HSComp.ResizablePanelGroup>
		</div>
	);
};
