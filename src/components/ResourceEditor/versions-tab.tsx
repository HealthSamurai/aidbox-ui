import * as HSComp from "@health-samurai/react-components";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import * as YAML from "js-yaml";
import { diff } from "../../utils/diff";
import { traverseTree } from "../../utils/tree-walker";
import { AidboxCallWithMeta } from "@aidbox-ui/api/auth";
import * as utils from "../../api/utils";
import {
	fetchResourceHistory,
	type HistoryBundle,
	type HistoryEntry,
} from "./api";
import { pageId, type EditorMode } from "./types";
import { DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { generateDiffFile } from "@git-diff-view/file";

const prettyStatus = (code: string) =>
	({ "201": "Created", "200": "Updated", "204": "Deleted" })[code] || code;

type VersionsTabProps = { id: string; resourceType: string };

type historyWithHistoryProps = {
	versionId: string;
	date: Date | string;
	status: string;
	resourceCurrent: HistoryEntry;
	resourcePrevious: HistoryEntry | null;
	affected: Set<(string | number)[]>;
};

const ConfirmationDialog = ({
	versionId,
	lastUpdated,
	onConfirm,
	onCancel,
}: {
	versionId: string;
	lastUpdated: string;
	onConfirm: () => void;
	onCancel: () => void;
}) => {
	return (
		<HSComp.DialogContent showCloseButton={false}>
			<HSComp.DialogHeader>
				<HSComp.DialogTitle>Confirm Restore</HSComp.DialogTitle>
			</HSComp.DialogHeader>
			<div className="py-4">
				<p>Are you sure you want to restore the resource to this version?</p>
				<p className="mt-2">
					<strong>Version ID:</strong> {versionId}
				</p>
				<p>
					<strong>Created at:</strong> {lastUpdated}
				</p>
			</div>
			<div className="flex gap-2 justify-end">
				<HSComp.Button variant="secondary" onClick={onCancel}>
					Cancel
				</HSComp.Button>
				<HSComp.Button variant="primary" onClick={onConfirm}>
					Restore
				</HSComp.Button>
			</div>
		</HSComp.DialogContent>
	);
};

type OpenState = "hidden" | "shown" | "confirm";

const VersionDiffDialog = ({
	previous,
	current,
	resourceType,
	resourceId,
	openState,
	onOpenChange,
}: {
	previous: any;
	current: any;
	resourceType: string;
	resourceId: string;
	openState: OpenState;
	onOpenChange: (open: OpenState) => void;
}) => {
	const diff = generateDiffFile(
		"prev.json",
		JSON.stringify(previous, null, "  "),
		"current.json",
		JSON.stringify(current, null, "  "),
		"json",
		"json",
	);

	const data = { hunks: diff._diffList };
	const version = previous?.meta?.versionId;

	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (resource: string) => {
			return AidboxCallWithMeta({
				method: "PUT",
				url: `/fhir/${resourceType}/${resourceId}`,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: resource,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [pageId, resourceType, resourceId, "history"],
			});
			HSComp.toast.success(
				version
					? `Version ${version} restored successfully`
					: `Version restored successfully`,
				{
					position: "bottom-right",
					style: { margin: "1rem" },
				},
			);
			onOpenChange("hidden");
		},
		onError: utils.onError(),
	});

	return (
		<>
			<HSComp.DialogContent
				className="max-w-[90vw] max-h-[90vh] flex flex-col"
				showCloseButton={false}
			>
				<div className="overflow-auto flex-1">
					<DiffView data={data} diffViewMode={4} diffViewHighlight={true} />
				</div>
				<div className="flex gap-2 justify-end pt-4">
					<HSComp.DialogClose asChild>
						<HSComp.Button variant="secondary">Cancel</HSComp.Button>
					</HSComp.DialogClose>
					<HSComp.Button
						variant="primary"
						onClick={() => onOpenChange("confirm")}
					>
						Restore
					</HSComp.Button>
				</div>
			</HSComp.DialogContent>
			{openState === "confirm" && (
				<ConfirmationDialog
					lastUpdated={
						previous?.meta?.lastUpdated
							? new Date(previous.meta.lastUpdated).toLocaleString()
							: "-"
					}
					versionId={version || ""}
					onConfirm={() => mutation.mutate(JSON.stringify(previous))}
					onCancel={() => onOpenChange("shown")}
				/>
			)}
		</>
	);
};

const VersionViewDialog = ({
	resource,
	resourceType,
	resourceId,
	openState,
	onOpenStateChange,
}: {
	resource: any;
	resourceType: string;
	resourceId: string;
	openState: OpenState;
	onOpenStateChange: (open: OpenState) => void;
}) => {
	const queryClient = useQueryClient();
	const [mode, setMode] = React.useState<EditorMode>("json");

	const version = resource?.meta?.versionId;

	const mutation = useMutation({
		mutationFn: (resource: string) => {
			return AidboxCallWithMeta({
				method: "PUT",
				url: `/fhir/${resourceType}/${resourceId}`,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: resource,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [pageId, resourceType, resourceId, "history"],
			});
			HSComp.toast.success(
				version
					? `Version ${version} restored successfully`
					: `Version restored successfully`,
				{
					position: "bottom-right",
					style: { margin: "1rem" },
				},
			);
			onOpenStateChange("hidden");
		},
		onError: utils.onError(),
	});

	const indent = 2;

	return (
		<>
			<HSComp.DialogContent
				className="w-[800px] min-w-[800px] max-h-full flex flex-col"
				showCloseButton={false}
			>
				<HSComp.DialogHeader>
					<HSComp.DialogTitle>
						Version {resource?.meta?.versionId}
					</HSComp.DialogTitle>
				</HSComp.DialogHeader>
				<div className="overflow-auto flex-1">
					<div className="absolute top-3 right-3 z-10">
						<div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
							<HSComp.SegmentControl
								defaultValue={mode}
								name="version-view-format"
								onValueChange={(value) => setMode(value as EditorMode)}
							>
								<HSComp.SegmentControlItem value="json">
									JSON
								</HSComp.SegmentControlItem>
								<HSComp.SegmentControlItem value="yaml">
									YAML
								</HSComp.SegmentControlItem>
							</HSComp.SegmentControl>
						</div>
					</div>
					<HSComp.CodeEditor
						readOnly
						currentValue={
							mode === "json"
								? JSON.stringify(resource, null, indent)
								: YAML.dump(resource, { indent })
						}
						mode={mode}
					/>
				</div>
				<div className="flex gap-2 justify-end pt-4">
					<HSComp.DialogClose asChild>
						<HSComp.Button variant="secondary">Cancel</HSComp.Button>
					</HSComp.DialogClose>
					<HSComp.Button
						variant="primary"
						onClick={() => onOpenStateChange("confirm")}
					>
						Restore
					</HSComp.Button>
				</div>
			</HSComp.DialogContent>
			{openState === "confirm" && (
				<ConfirmationDialog
					lastUpdated={
						resource?.meta?.lastUpdated
							? new Date(resource.meta.lastUpdated).toLocaleString()
							: "-"
					}
					versionId={version || ""}
					onConfirm={() => mutation.mutate(JSON.stringify(resource))}
					onCancel={() => onOpenStateChange("shown")}
				/>
			)}
		</>
	);
};

const calculateAffectedAttributes = (previous: any, current: any) => {
	if (!previous) return new Set<(string | number)[]>();

	const [inPrevious, inCurrent] = diff(previous, current);

	const changes = [inPrevious, inCurrent];

	const pathTree = traverseTree(
		(acc, x, path) => {
			if (x && path.length > 1) {
				const pathCopy = [...path.slice(1)];
				let current: any = acc;
				pathCopy.forEach((key) => {
					if (!(key in current)) {
						current[key] = {};
					}
					current = current[key];
				});
				const lastKey = pathCopy.at(-1);
				if (lastKey !== undefined) {
					current[lastKey] = {};
				}
			}
			return acc;
		},
		{},
		changes,
	);

	const affectedPaths = traverseTree(
		(acc, x, path) => {
			if (
				x &&
				typeof x === "object" &&
				Object.keys(x).length === 0 &&
				!Array.isArray(x)
			) {
				acc.add(path);
			}
			return acc;
		},
		new Set<(string | number)[]>(),
		pathTree,
	);

	return affectedPaths;
};

export const VersionsTab = ({ id, resourceType }: VersionsTabProps) => {
	const [history, setHistory] = React.useState<HistoryBundle>();

	const {
		data: historyData,
		isLoading,
		error,
	} = useQuery({
		queryKey: [pageId, resourceType, id, "history"],
		queryFn: async () => {
			return await fetchResourceHistory(resourceType, id);
		},
	});

	React.useEffect(() => {
		if (historyData !== null) {
			setHistory(historyData);
		}
	}, [historyData]);

	if (isLoading || !history) {
		return <div>Loading...</div>;
	}

	if (error) {
		return <div>Error loading history: {(error as Error).message}</div>;
	}

	const columns = [
		{
			accessorKey: "versionId",
			header: <span className="pl-5">versionId</span>,
			cell: (info: any) => {
				const row = info.row.original;
				const [open, setOpen] = React.useState<OpenState>("hidden");
				return (
					<HSComp.Dialog
						open={open !== "hidden"}
						onOpenChange={(open: boolean) => setOpen(open ? "shown" : "hidden")}
					>
						<HSComp.DialogTrigger asChild>
							<button
								type="button"
								className="text-blue-600 hover:underline cursor-pointer"
							>
								{info.getValue()}
							</button>
						</HSComp.DialogTrigger>
						<VersionViewDialog
							resource={row.resourceCurrent}
							resourceType={resourceType}
							resourceId={id}
							openState={open}
							onOpenStateChange={setOpen}
						/>
					</HSComp.Dialog>
				);
			},
		},
		{
			accessorKey: "status",
			header: <span className="pl-5">Status</span>,
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "date",
			header: <span className="pl-5">Date</span>,
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "affected",
			header: <span className="pl-5">Affected attributes</span>,
			cell: (info: any) => {
				const items: (string | number)[][] = Array.from(info.getValue());
				const affectedStr = [
					...new Set(items.map((e: (string | number)[]) => e.at(0))),
				]
					.sort()
					.join(", ");
				const row = info.row.original;
				const [open, setOpen] = React.useState<OpenState>("hidden");
				return (
					<HSComp.Dialog
						open={open !== "hidden"}
						onOpenChange={(open: boolean) => setOpen(open ? "shown" : "hidden")}
					>
						<HSComp.DialogTrigger asChild>
							<button
								type="button"
								className="text-blue-600 hover:underline cursor-pointer"
							>
								{affectedStr}
							</button>
						</HSComp.DialogTrigger>
						<VersionDiffDialog
							previous={row.resourcePrevious}
							current={row.resourceCurrent}
							resourceType={resourceType}
							resourceId={id}
							onOpenChange={setOpen}
							openState={open}
						/>
					</HSComp.Dialog>
				);
			},
		},
	];

	const historyWithHistory = history.entry
		.sort(
			(a: HistoryEntry, b: HistoryEntry) =>
				parseInt(a.resource.meta.versionId) -
				parseInt(b.resource.meta.versionId),
		)
		.reduce(
			(
				acc: { result: historyWithHistoryProps[]; prev: HistoryEntry | null },
				entry: any,
			) => {
				const resource = entry.resource;
				acc.result.push({
					versionId: resource.meta.versionId,
					date: resource.meta.lastUpdated
						? new Date(resource.meta.lastUpdated).toLocaleString()
						: "-",
					status: prettyStatus(entry.response.status),
					resourceCurrent: resource,
					resourcePrevious: acc.prev,
					affected: calculateAffectedAttributes(acc.prev, resource),
				});
				acc.prev = resource;
				return acc;
			},
			{ result: [], prev: null },
		);

	return (
		<HSComp.DataTable
			columns={columns as any}
			data={historyWithHistory.result.reverse()}
			stickyHeader
		/>
	);
};
