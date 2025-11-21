import type {
	Bundle,
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { DiffView } from "@git-diff-view/react";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as YAML from "js-yaml";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { diff } from "../../utils/diff";
import { traverseTree } from "../../utils/tree-walker";
import { fetchResourceHistory } from "./api";
import { type EditorMode, pageId } from "./types";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { generateDiffFile } from "@git-diff-view/file";

const prettyStatus = (code: string) =>
	({ "201": "Created", "200": "Updated", "204": "Deleted" })[code] || code;

type VersionsTabProps = { id: string; resourceType: string };

type historyWithHistoryProps = {
	versionId: string;
	date: Date | string;
	status: string;
	resourceCurrent: Resource;
	resourcePrevious: Resource | null;
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
	previous: Resource | null;
	current: Resource;
	resourceType: string;
	resourceId: string;
	openState: OpenState;
	onOpenChange: (open: OpenState) => void;
}) => {
	const client = useAidboxClient();

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
			return client.request({
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
		onError: Utils.toastAidboxErrorResponse,
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
	resource: Resource;
	resourceType: string;
	resourceId: string;
	openState: OpenState;
	onOpenStateChange: (open: OpenState) => void;
}) => {
	const client = useAidboxClient();

	const queryClient = useQueryClient();
	const [mode, setMode] = React.useState<EditorMode>("json");

	const version = resource?.meta?.versionId;

	const mutation = useMutation({
		mutationFn: (resource: string) => {
			return client.request({
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
		onError: Utils.toastAidboxErrorResponse,
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

type NestedData = { [key: PropertyKey]: NestedData };

function VersionIdCell({
	resource,
	resourceType,
	versionId,
	id,
}: {
	resource: Resource;
	resourceType: string;
	versionId: string;
	id: string;
}) {
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
					{versionId}
				</button>
			</HSComp.DialogTrigger>
			<VersionViewDialog
				resource={resource}
				resourceType={resourceType}
				resourceId={id}
				openState={open}
				onOpenStateChange={setOpen}
			/>
		</HSComp.Dialog>
	);
}

function AffectedCell({
	resourceType,
	id,
	affected,
	previousResource,
	currentResource,
}: {
	previousResource: Resource | null;
	currentResource: Resource;
	resourceType: string;
	id: string;
	affected: Set<(string | number)[]>;
}) {
	const items: (string | number)[][] = Array.from(affected);
	const affectedStr = [
		...new Set(items.map((e: (string | number)[]) => e.at(0))),
	]
		.sort()
		.join(", ");
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
				previous={previousResource}
				current={currentResource}
				resourceType={resourceType}
				resourceId={id}
				onOpenChange={setOpen}
				openState={open}
			/>
		</HSComp.Dialog>
	);
}

const calculateAffectedAttributes = (
	previous: Resource | null,
	current: Resource,
) => {
	if (!previous) return new Set<(string | number)[]>();

	const [inPrevious, inCurrent] = diff(previous, current);

	const changes = [inPrevious, inCurrent];

	const pathTree = traverseTree<NestedData>(
		(acc, x, path) => {
			if (x && path.length > 1) {
				const pathCopy = [...path.slice(1)];
				let current = acc;
				pathCopy.forEach((key) => {
					let next: NestedData;
					if (!(key in current)) {
						next = {};
						current[key] = next;
					} else {
						next = current[key] as NonNullable<(typeof current)[typeof key]>;
					}

					current = next;
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
	const client = useAidboxClient();

	const [history, setHistory] = React.useState<Bundle>();

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

	const columns: HSComp.ColumnDef<historyWithHistoryProps>[] = [
		{
			accessorKey: "versionId",
			header: () => <span className="pl-5">versionId</span>,
			cell: (info) => (
				<VersionIdCell
					resource={info.row.original.resourceCurrent}
					resourceType={resourceType}
					id={id}
					versionId={info.getValue() as historyWithHistoryProps["versionId"]}
				/>
			),
		},
		{
			accessorKey: "status",
			header: () => <span className="pl-5">Status</span>,
			cell: (info) => info.getValue(),
		},
		{
			accessorKey: "date",
			header: () => <span className="pl-5">Date</span>,
			cell: (info) => info.getValue(),
		},
		{
			accessorKey: "affected",
			header: () => <span className="pl-5">Affected attributes</span>,
			cell: (info) => (
				<AffectedCell
					id={id}
					resourceType={resourceType}
					currentResource={info.row.original.resourceCurrent}
					previousResource={info.row.original.resourcePrevious}
					affected={info.getValue() as historyWithHistoryProps["affected"]}
				/>
			),
		},
	];

	try {
		const historyWithHistory = history.entry
			?.map((x: BundleEntry) => {
				const versionId = x?.resource?.meta?.versionId;
				if (versionId === undefined)
					throw Error("No version ID in history item", { cause: x });

				return { ...x, versionId };
			})
			.sort(
				(a, b) => parseInt(a.versionId || "0") - parseInt(b.versionId || "0"),
			)
			.reduce(
				(
					acc: {
						result: historyWithHistoryProps[];
						prev: Resource | null;
					},
					entry,
				) => {
					const resource = entry.resource;
					if (resource === undefined)
						throw Error("History item is missing the resource", {
							cause: resource,
						});
					if (!entry?.response?.status)
						throw Error("History item is missing a response status", {
							cause: entry,
						});

					acc.result.push({
						versionId: entry.versionId,
						date: resource.meta?.lastUpdated
							? new Date(resource.meta.lastUpdated).toLocaleString()
							: "-",
						status: prettyStatus(entry?.response?.status),
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
				columns={columns}
				data={historyWithHistory?.result.reverse() || []}
				stickyHeader
			/>
		);
	} catch {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Error loading version list</div>
					<div className="text-sm">ID: {id}</div>
				</div>
			</div>
		);
	}
};
