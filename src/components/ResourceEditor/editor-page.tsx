import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import type { NavigateOptions, RegisteredRouter } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import React from "react";
import { fetchResource } from "./api";
import { EditorTab } from "./editor-tab";
import { type EditorMode, queryKey, type ResourceEditorTab } from "./types";
import { VersionsTab } from "./versions-tab";

interface ResourceEditorPageProps {
	id?: string;
	resourceType: string;
	tab: ResourceEditorTab;
	indent?: number;
	navigate: <T extends string>(
		opts: NavigateOptions<RegisteredRouter, T, T>,
	) => Promise<void>;
}

export const ResourceEditorPage = ({
	id,
	resourceType,
	tab,
	indent = 2,
	navigate,
}: ResourceEditorPageProps) => {
	const [mode, setMode] = React.useState<EditorMode>("json");
	const [resourceText, setResourceText] = React.useState<string>(
		JSON.stringify({ resourceType: resourceType }, undefined, indent),
	);

	const {
		data: resource,
		isLoading,
		error,
	} = useQuery({
		enabled: id !== undefined,
		queryKey: [queryKey, resourceType, id],
		queryFn: async () => {
			if (!id) throw new Error("Impossible");
			return await fetchResource(resourceType, id);
		},
	});

	React.useEffect(() => {
		let text: string;
		if (resource) {
			if (mode === "yaml") text = yaml.dump(resource, { indent });
			else text = JSON.stringify(resource, null, indent);
			setResourceText(text);
		}
	}, [resource, mode, indent]);

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
					<HSComp.TabsList>
						<HSComp.TabsTrigger value="code">Edit</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="version">Versions</HSComp.TabsTrigger>
					</HSComp.TabsList>
				</div>
			</div>
			<HSComp.TabsContent value={"code"} className="py-1 px-2.5">
				<EditorTab
					mode={mode}
					resourceText={resourceText}
					setResourceText={setResourceText}
				/>
			</HSComp.TabsContent>
			<HSComp.TabsContent value={"version"}>
				<VersionsTab id={id!} resourceType={resourceType} />
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
};
