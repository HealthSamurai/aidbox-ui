import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { diff } from "../../utils/diff";
import { traverseTree } from "../../utils/tree-walker";
import {
	fetchResourceHistory,
	type HistoryBundle,
	type HistoryEntry,
} from "./api";
import { queryKey } from "./types";

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
		queryKey: [queryKey, resourceType, id, "history"],
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
			cell: (info: any) => info.getValue(),
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
				return [...new Set(items.map((e: (string | number)[]) => e.at(0)))]
					.sort()
					.join(", ");
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
