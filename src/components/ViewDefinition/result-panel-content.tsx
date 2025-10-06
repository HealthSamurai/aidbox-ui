import { useMemo, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	CodeEditor,
	type ColumnDef,
	DataTable,
} from "@health-samurai/react-components";
import { ViewDefinitionContext } from "./page";
import * as Constants from "./constants";

const processTableData = (
	response: string | undefined,
): {
	tableData: any[];
	columns: ColumnDef<Record<string, any>, any>[];
	isEmptyArray: boolean;
} => {
	if (!response) {
		return { tableData: [], columns: [], isEmptyArray: false };
	}

	try {
		const parsedResponse = JSON.parse(response);

		if (Array.isArray(parsedResponse) && parsedResponse.length === 0) {
			return { tableData: [], columns: [], isEmptyArray: true };
		}

		if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
			const allKeys = new Set<string>();
			parsedResponse.forEach((row) => {
				if (typeof row === "object" && row !== null) {
					Object.keys(row).forEach((key) => allKeys.add(key));
				}
			});

			const columns: ColumnDef<Record<string, any>, any>[] = Array.from(
				allKeys,
			).map((key) => ({
				accessorKey: key,
				header: key.charAt(0).toUpperCase() + key.slice(1),
				cell: ({ getValue }) => {
					const value = getValue();
					if (value === null || value === undefined) {
						return <span className="text-text-tertiary">null</span>;
					}
					return String(value);
				},
			}));

			return { tableData: parsedResponse, columns, isEmptyArray: false };
		}
	} catch (error) {
		// Error parsing response
	}

	return { tableData: [], columns: [], isEmptyArray: false };
};

export function ResultPanel() {
	const viewDefinitionContext = useContext(ViewDefinitionContext);

	const rows = viewDefinitionContext.runResult;

	const { tableData, columns, isEmptyArray } = useMemo(() => {
		return processTableData(rows);
	}, [rows]);

		return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-center bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
				<span className="typo-label text-text-secondary">
					View Definition Result: {tableData.length} row
					{tableData.length !== 1 ? "s" : ""}
				</span>
			</div>
			{rows ? (
				isEmptyArray ? (
					<div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
						<div className="text-center">
							<div className="text-lg mb-2">No results</div>
							<div className="text-sm">
								The query executed successfully but returned no data
							</div>
						</div>
					</div>
				) : tableData.length > 0 ? (
					<div className="flex-1 overflow-auto">
						<DataTable columns={columns} data={tableData} />
					</div>
				) : (
					<div className="flex-1 p-4">
						<CodeEditor readOnly={true} currentValue={rows} mode="json" />
					</div>
				)
			) : (
				<div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
					<div className="text-center">
						<div className="text-lg mb-2">No results yet</div>
						<div className="text-sm">
							Click Run to execute the ViewDefinition
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
