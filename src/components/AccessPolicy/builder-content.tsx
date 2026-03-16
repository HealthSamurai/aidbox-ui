import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as YAML from "js-yaml";
import * as Lucide from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { updateResource } from "../ResourceEditor/api";
import { EditorTab } from "../ResourceEditor/editor-tab";
import type { EditorMode } from "../ResourceEditor/types";
import { pageId } from "../ResourceEditor/types";
import { DevToolRequestPanel } from "./dev-tool-request-panel";
import { AccessPolicyContext } from "./page";

const STRIPPED_KEYS = ["id", "resourceType", "meta"] as const;

function stripResource(resource: Resource): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(resource)) {
		if (!(STRIPPED_KEYS as readonly string[]).includes(key)) {
			result[key] = value;
		}
	}
	return result;
}

function serializeResource(
	resource: Record<string, unknown>,
	mode: EditorMode,
	indent: number,
): string {
	if (mode === "yaml") {
		return YAML.dump(resource, { indent });
	}
	return JSON.stringify(resource, null, indent);
}

export const AccessPolicyBuilderContent = () => {
	const { accessPolicyId, accessPolicy, setAccessPolicy, setIsDirty } =
		React.useContext(AccessPolicyContext);
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const indent = 2;
	const [mode, setMode] = React.useState<EditorMode>("yaml");

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!accessPolicy || !accessPolicyId) return;
			return await updateResource(
				client,
				accessPolicy.resourceType,
				accessPolicyId,
				accessPolicy,
			);
		},
		onError: Utils.onMutationError,
		onSuccess: () => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			setIsDirty(false);
			queryClient.invalidateQueries({
				queryKey: [pageId, accessPolicy?.resourceType, accessPolicyId],
			});
		},
	});

	const strippedRef = React.useRef(
		accessPolicy ? stripResource(accessPolicy) : {},
	);
	const initialStrippedTextRef = React.useRef(
		serializeResource(strippedRef.current, mode, indent),
	);
	const [strippedText, setStrippedText] = React.useState(
		initialStrippedTextRef.current,
	);

	const handleTextChange = (text: string) => {
		setStrippedText(text);
		setIsDirty(text !== initialStrippedTextRef.current);
		try {
			const parsed = mode === "yaml" ? YAML.load(text) : JSON.parse(text);
			strippedRef.current = parsed;
			if (accessPolicy) {
				const full = {
					...parsed,
					id: accessPolicy.id,
					resourceType: accessPolicy.resourceType,
					meta: (accessPolicy as Record<string, unknown>).meta,
				};
				setAccessPolicy(full);
			}
		} catch {
			// keep text as-is if parsing fails
		}
	};

	const handleSetMode = (newMode: EditorMode) => {
		try {
			const parsed =
				mode === "yaml" ? YAML.load(strippedText) : JSON.parse(strippedText);
			const newText = serializeResource(parsed, newMode, indent);
			setStrippedText(newText);
			initialStrippedTextRef.current = newText;
			strippedRef.current = parsed;
		} catch {
			// keep current if parsing fails
		}
		setMode(newMode);
	};

	const triggerFormat = () => {
		setStrippedText(serializeResource(strippedRef.current, mode, indent));
	};

	const actions = accessPolicyId ? (
		<HSComp.Button
			variant="ghost"
			size="small"
			className="px-0! text-text-link"
			onClick={(event) => {
				event.preventDefault();
				saveMutation.mutate();
			}}
		>
			<Lucide.SaveIcon className="w-4 h-4" />
			Save
		</HSComp.Button>
	) : null;

	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="access-policy-builder"
		>
			<HSComp.ResizablePanel minSize={20}>
				<EditorTab
					mode={mode}
					setMode={handleSetMode}
					triggerFormat={triggerFormat}
					resourceText={strippedText}
					defaultResourceText={strippedText}
					setResourceText={handleTextChange}
					actions={actions}
				/>
			</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel minSize={30}>
				<DevToolRequestPanel />
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
};
