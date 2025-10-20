import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchResourceHistory, type HistoryBundle } from "./api";
import { queryKey } from "./types";

const prettyStatus = (code: string) =>
	({ "201": "Created", "200": "Updated", "204": "Deleted" })[code] || code;

type VersionsTabProps = { id: string; resourceType: string };

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
			cell: (info: any) => info.row.original.resource?.meta?.versionId,
		},
		{
			accessorKey: "status",
			header: <span className="pl-5">Status</span>,
			cell: (info: any) => prettyStatus(info.row.original.response.status),
		},
		{
			accessorKey: "date",
			header: <span className="pl-5">Date</span>,
			cell: (info: any) =>
				info.row.original.resource.meta.lastUpdated
					? new Date(
							info.row.original.resource.meta.lastUpdated,
						).toLocaleString()
					: "-",
		},
		{
			accessorKey: "attributes",
			header: <span className="pl-5">Affected attributes</span>,
			cell: (info: any) => {
				console.log(info.row.original);
				return "";
			},
		},
	];

	return (
		<HSComp.DataTable
			columns={columns as any}
			data={history.entry}
			stickyHeader
		/>
	);
};
