import {
	CodeEditor,
	type ColumnDef,
	DataTable,
} from "@health-samurai/react-components";
import { useContext, useMemo } from "react";
import { ViewDefinitionContext } from "./page";

interface ProcessedTableData {
	tableData: any[];
	columns: ColumnDef<Record<string, any>, any>[];
	isEmptyArray: boolean;
}

const parseResponse = (response: string | undefined): any[] | null => {
	if (!response) {
		return null;
	}

	try {
		const parsed = JSON.parse(response);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const extractColumns = (data: any[]): ColumnDef<Record<string, any>, any>[] => {
	const allKeys = new Set<string>();
	data.forEach((row) => {
		if (typeof row === "object" && row !== null) {
			Object.keys(row).forEach((key) => allKeys.add(key));
		}
	});

	return Array.from(allKeys).map((key) => ({
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
};

const processTableData = (response: string | undefined): ProcessedTableData => {
	const parsedData = parseResponse(response);

	if (!parsedData) {
		return { tableData: [], columns: [], isEmptyArray: false };
	}

	if (parsedData.length === 0) {
		return { tableData: [], columns: [], isEmptyArray: true };
	}

	const columns = extractColumns(parsedData);
	return { tableData: parsedData, columns, isEmptyArray: false };
};

const EmptyState = ({
	message,
	description,
}: {
	message: string;
	description: string;
}) => (
	<div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
		<div className="text-center">
			<div className="text-lg mb-2">{message}</div>
			<div className="text-sm">{description}</div>
		</div>
	</div>
);

const ResultHeader = ({ rowCount }: { rowCount: number }) => (
	<div className="flex gap-1 items-center justify-left bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
		<span className="typo-label text-text-secondary">
			Result:
		</span>
		<span className="typo-label text-text-link">
			{rowCount} row{rowCount !== 1 ? "s" : ""}
		</span>
	</div>
);

const ResultContent = ({
	rows,
	isEmptyArray,
	tableData,
	columns,
}: {
	rows: string | undefined;
	isEmptyArray: boolean;
	tableData: any[];
	columns: ColumnDef<Record<string, any>, any>[];
}) => {
	if (!rows) {
		return (
			<EmptyState
				message="No results yet"
				description="Click Run to execute the ViewDefinition"
			/>
		);
	}

	if (isEmptyArray) {
		return (
			<EmptyState
				message="No results"
				description="The query executed successfully but returned no data"
			/>
		);
	}

	if (tableData.length > 0) {
		return (
			<div className="flex-1 overflow-hidden min-h-0">
				<DataTable columns={columns} data={tableData} stickyHeader />
			</div>
		);
	}

	return (
		<div className="flex-1 p-4">
			<CodeEditor readOnly={true} currentValue={rows} mode="json" />
		</div>
	);
};

export function ResultPanel() {
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const rows = viewDefinitionContext.runResult;

	const { tableData, columns, isEmptyArray } = useMemo(
		() => processTableData(rows),
		[rows],
	);

	return (
		<div className="flex flex-col h-full">
			<ResultHeader rowCount={tableData.length} />
			<ResultContent
				rows={rows}
				isEmptyArray={isEmptyArray}
				tableData={tableData}
				columns={columns}
			/>
		</div>
	);
}
