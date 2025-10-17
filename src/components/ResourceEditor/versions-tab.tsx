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

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (error) {
		return <div>Error loading history: {(error as Error).message}</div>;
	}

	return (
		<table>
			<thead>
				<tr>
					<th>Version ID</th>
					<th>Status</th>
					<th>Date</th>
				</tr>
			</thead>
			<tbody>
				{history?.entry?.map((entry) => (
					<tr key={entry.resource.meta.versionId}>
						<td>{entry.resource.meta.versionId}</td>
						<td>{prettyStatus(entry.response.status)}</td>
						<td>
							{entry.resource.meta.lastUpdated
								? new Date(entry.resource.meta.lastUpdated).toLocaleString()
								: "-"}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};
