import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
import React from "react";
import { DeleteButton, SaveButton } from "./action";
import { fetchResource } from "./api";
import { EditorTab } from "./editor-tab";
import { type EditorMode, pageId, type ResourceEditorTab } from "./types";
import { VersionsTab } from "./versions-tab";

interface ResourceEditorPageProps {
	id?: string;
	resourceType: string;
	tab: ResourceEditorTab;
	mode: EditorMode;
	indent?: number;
	navigate: <T extends string>(
		opts: Router.NavigateOptions<Router.RegisteredRouter, T, T>,
	) => Promise<void>;
}

export const ResourceEditorPage = ({
	id,
	resourceType,
	tab,
	mode,
	indent = 2,
	navigate,
}: ResourceEditorPageProps) => {
	const [formatSignal, setFormatSignal] = React.useState<unknown>({});
	const [resourceText, setResourceText] = React.useState<string>(
		JSON.stringify({ resourceType: resourceType }, undefined, indent),
	);
	const setMode = (mode: EditorMode) => {
		navigate({ search: { mode: mode } });
	};

	const {
		data: resourceData,
		isLoading,
		error,
	} = useQuery({
		enabled: id !== undefined,
		queryKey: [pageId, resourceType, id],
		queryFn: async () => {
			if (!id) throw new Error("Impossible");
			return await fetchResource(resourceType, id);
		},
		retry: false,
	});

	React.useEffect(() => {
		// FIXME: don't work for Create (resource always undefined), drop state on switch mode
		let text: string;
		if (resourceData) {
			if (mode === "yaml") text = YAML.dump(resourceData, { indent });
			else text = JSON.stringify(resourceData, null, indent);
			formatSignal;
			setResourceText(text);
		}
	}, [resourceData, mode, indent, formatSignal]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading Resource...</div>
					<div className="text-sm">ID: {id}</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-red-500">
				<div className="text-center">
					<div className="text-lg mb-2">Failed to load resource</div>
					<div className="text-sm">{error.message}</div>
				</div>
			</div>
		);
	}

	const tabs = [
		{
			trigger: <HSComp.TabsTrigger value="code">Edit</HSComp.TabsTrigger>,
			content: (
				<HSComp.TabsContent value={"code"} className="py-1 px-2.5">
					<EditorTab
						mode={mode}
						setMode={setMode}
						triggerFormat={() => setFormatSignal({})}
						defaultResourceText={resourceText}
						setResourceText={setResourceText}
					/>
				</HSComp.TabsContent>
			),
		},
	];

	const actions = [
		{
			content: (
				<SaveButton
					resourceType={resourceType}
					id={id}
					resource={resourceText}
					mode={mode}
				/>
			),
		},
	];

	if (id) {
		tabs.push({
			trigger: (
				<HSComp.TabsTrigger value="version">Versions</HSComp.TabsTrigger>
			),
			content: (
				<HSComp.TabsContent value={"version"}>
					<VersionsTab id={id} resourceType={resourceType} />
				</HSComp.TabsContent>
			),
		});
		actions.push({
			content: <DeleteButton resourceType={resourceType} id={id} />,
		});
	}

	const handleOnTabSelect = (value: ResourceEditorTab) =>
		navigate({ search: { tab: value } });

	return (
		<HSComp.Tabs
			defaultValue={tab}
			onValueChange={handleOnTabSelect}
			className="grow min-h-0"
		>
			<div className="flex items-center justify-between gap-4 bg-bg-secondary px-6 border-b h-10 flex-none">
				<div className="flex items-center gap-3">
					<HSComp.TabsList>{tabs.map((t) => t.trigger)}</HSComp.TabsList>
				</div>
				<div className="flex items-center gap-3">
					{actions.map((a) => a.content)}
				</div>
			</div>
			{tabs.map((t) => t.content)}
		</HSComp.Tabs>
	);
};
