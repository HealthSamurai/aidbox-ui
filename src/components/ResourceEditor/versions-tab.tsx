import type {
	Bundle,
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { generateDiffFile } from "@git-diff-view/file";
import { DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as yaml from "js-yaml";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { fetchResourceHistory } from "./api";
import { pageId } from "./types";

type VersionsTabProps = { id: string; resourceType: string };

type VersionEntry = {
	versionId: string;
	date: string;
	resourceCurrent: Resource;
	resourcePrevious: Resource | null;
};

type ViewMode = "raw" | "diff";
type EditorMode = "json" | "yaml";

function processHistory(history: Bundle): VersionEntry[] {
	const entries = history.entry
		?.map((x: BundleEntry) => {
			const versionId = x?.resource?.meta?.versionId;
			if (versionId === undefined)
				throw Error("No version ID in history item", { cause: x });
			return { ...x, versionId };
		})
		.sort((a, b) => parseInt(a.versionId || "0") - parseInt(b.versionId || "0"))
		.reduce(
			(acc: { result: VersionEntry[]; prev: Resource | null }, entry) => {
				const resource = entry.resource;
				if (resource === undefined)
					throw Error("History item is missing the resource", {
						cause: resource,
					});
				acc.result.push({
					versionId: entry.versionId,
					date: resource.meta?.lastUpdated
						? resource.meta.lastUpdated.replace(/\.\d+Z$/, "").replace("Z", "")
						: "-",
					resourceCurrent: resource,
					resourcePrevious: acc.prev,
				});
				acc.prev = resource;
				return acc;
			},
			{ result: [], prev: null },
		);

	return entries?.result.reverse() || [];
}

export const VersionsTab = ({ id, resourceType }: VersionsTabProps) => {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	const [selectedVersionId, setSelectedVersionId] = React.useState<
		string | null
	>(null);
	const [viewMode, setViewMode] = React.useState<ViewMode>("raw");
	const [editorMode, setEditorMode] = React.useState<EditorMode>("json");
	const [confirmRestore, setConfirmRestore] = React.useState(false);

	const {
		data: historyData,
		isLoading,
		error,
	} = useQuery({
		queryKey: [pageId, resourceType, id, "history"],
		queryFn: async () => {
			return await fetchResourceHistory(client, resourceType, id);
		},
	});

	const versions = React.useMemo(() => {
		if (!historyData) return [];
		try {
			return processHistory(historyData);
		} catch {
			return [];
		}
	}, [historyData]);

	React.useEffect(() => {
		if (versions.length > 0 && selectedVersionId === null) {
			setSelectedVersionId(versions[0].versionId);
		}
	}, [versions, selectedVersionId]);

	const selectedVersion = versions.find(
		(v) => v.versionId === selectedVersionId,
	);

	const diffData = React.useMemo(() => {
		if (!selectedVersion?.resourcePrevious) return null;
		const file = generateDiffFile(
			"prev.json",
			JSON.stringify(selectedVersion.resourcePrevious, null, "  "),
			"current.json",
			JSON.stringify(selectedVersion.resourceCurrent, null, "  "),
			"json",
			"json",
		);
		return { hunks: file._diffList };
	}, [selectedVersion]);

	const mutation = useMutation({
		mutationFn: (resource: Resource) => {
			return client.update({
				type: resourceType,
				id: id,
				resource: resource,
			});
		},
		onSuccess: (result) => {
			if (result.isErr())
				return Utils.toastOperationOutcome(result.value.resource);

			queryClient.invalidateQueries({
				queryKey: [pageId, resourceType, id, "history"],
			});
			HSComp.toast.success(
				selectedVersion
					? `Version ${selectedVersion.versionId} restored successfully`
					: "Version restored successfully",
				{ position: "bottom-right", style: { margin: "1rem" } },
			);
			setConfirmRestore(false);
		},
		onError: Utils.onMutationError,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Loading...
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-red-500">
				Error loading history: {(error as Error).message}
			</div>
		);
	}

	if (versions.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				No version history available
			</div>
		);
	}

	return (
		<div className="flex h-full">
			{/* Timeline sidebar */}
			<div className="w-[210px] flex-shrink-0 border-r border-border-secondary flex flex-col">
				<div className="h-10 bg-bg-secondary border-b border-border-secondary flex items-center px-4">
					<span className="text-text-secondary font-medium text-sm">
						Timeline
					</span>
				</div>
				<div className="flex-1 overflow-auto">
					{versions.map((v) => (
						<button
							key={v.versionId}
							type="button"
							onClick={() => setSelectedVersionId(v.versionId)}
							className={HSComp.cn(
								"w-full flex flex-col gap-1.5 border-b border-border-secondary text-left cursor-pointer",
								"pt-3 pr-2 pb-3 pl-4",
								selectedVersionId === v.versionId
									? "bg-bg-secondary"
									: "bg-bg-primary",
							)}
						>
							<span
								className={HSComp.cn(
									"text-sm",
									selectedVersionId === v.versionId
										? "text-text-primary"
										: "text-text-link",
								)}
							>
								{v.versionId}
							</span>
							<span className="text-[11px] text-text-secondary">{v.date}</span>
						</button>
					))}
				</div>
			</div>

			{/* Content area */}
			<HSComp.Tabs
				variant="tertiary"
				value={viewMode}
				onValueChange={(value) => setViewMode(value as ViewMode)}
				className="flex-1 flex flex-col min-w-0"
			>
				{/* Toolbar */}
				<div className="bg-bg-secondary flex items-center justify-between flex-none h-10 border-b">
					<HSComp.TabsList className="py-0! border-b-0! pr-0!">
						<HSComp.TabsTrigger value="raw">Raw</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="diff">Diff</HSComp.TabsTrigger>
					</HSComp.TabsList>
					{selectedVersionId !== versions[0]?.versionId && (
						<button
							type="button"
							className="text-text-link font-medium text-sm cursor-pointer px-4"
							onClick={() => setConfirmRestore(true)}
						>
							Restore
						</button>
					)}
				</div>

				{/* Content */}
				<HSComp.TabsContent
					value="raw"
					className="flex-1 overflow-auto bg-bg-secondary m-0!"
				>
					{selectedVersion && (
						<div className="relative h-full w-full">
							<div className="absolute top-2 right-3 z-10">
								<div className="flex items-center gap-2 border rounded-full py-2 pr-2 pl-2.5 border-border-secondary bg-bg-primary toolbar-shadow">
									<HSComp.SegmentControl
										value={editorMode}
										onValueChange={(value) =>
											setEditorMode(value as EditorMode)
										}
										items={[
											{ value: "json", label: "JSON" },
											{ value: "yaml", label: "YAML" },
										]}
									/>
									<HSComp.Button variant="ghost" size="small" asChild>
										<HSComp.CopyIcon
											text={
												editorMode === "yaml"
													? yaml.dump(selectedVersion.resourceCurrent, {
															indent: 2,
														})
													: JSON.stringify(
															selectedVersion.resourceCurrent,
															null,
															2,
														)
											}
										/>
									</HSComp.Button>
								</div>
							</div>
							<HSComp.CodeEditor
								readOnly
								currentValue={
									editorMode === "yaml"
										? yaml.dump(selectedVersion.resourceCurrent, {
												indent: 2,
											})
										: JSON.stringify(selectedVersion.resourceCurrent, null, 2)
								}
								mode={editorMode}
							/>
						</div>
					)}
				</HSComp.TabsContent>
				<HSComp.TabsContent
					value="diff"
					className="flex-1 overflow-auto bg-bg-secondary m-0!"
				>
					{diffData ? (
						<div
							className="h-full"
							style={
								{
									"--diff-del-content--": "#FDEDEA",
									"--diff-del-lineNumber--": "#FDEDEA",
									"--diff-del-content-highlight--": "#F9CAC3",
									"--diff-add-content--": "#F1F8E6",
									"--diff-add-lineNumber--": "#F1F8E6",
									"--diff-add-content-highlight--": "#C9E19B",
								} as React.CSSProperties
							}
						>
							<DiffView
								data={diffData}
								diffViewMode={4}
								diffViewHighlight={true}
							/>
						</div>
					) : (
						<div className="flex items-center justify-center h-full text-text-secondary">
							No previous version to compare with
						</div>
					)}
				</HSComp.TabsContent>
			</HSComp.Tabs>

			{/* Restore confirmation dialog */}
			<HSComp.Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
				{selectedVersion && (
					<HSComp.DialogContent showCloseButton={false}>
						<HSComp.DialogHeader>
							<HSComp.DialogTitle>Confirm Restore</HSComp.DialogTitle>
						</HSComp.DialogHeader>
						<div className="py-4">
							<p>
								Are you sure you want to restore the resource to this version?
							</p>
							<p className="mt-2">
								<strong>Version ID:</strong> {selectedVersion.versionId}
							</p>
							<p>
								<strong>Created at:</strong> {selectedVersion.date}
							</p>
						</div>
						<div className="flex gap-2 justify-end">
							<HSComp.Button
								variant="secondary"
								onClick={() => setConfirmRestore(false)}
							>
								Cancel
							</HSComp.Button>
							<HSComp.Button
								variant="primary"
								onClick={() => mutation.mutate(selectedVersion.resourceCurrent)}
							>
								Restore
							</HSComp.Button>
						</div>
					</HSComp.DialogContent>
				)}
			</HSComp.Dialog>
		</div>
	);
};
