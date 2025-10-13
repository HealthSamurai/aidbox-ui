import {
	Button,
	CodeEditor,
	type ColumnDef,
	DataTable,
	Pagination,
	PaginationContent,
	PaginationNext,
	PaginationPageSizeSelector,
	PaginationPrevious,
} from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { Maximize2, Minimize2 } from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { AidboxCallWithMeta } from "../../api/auth";
import { ViewDefinitionContext } from "./page";
import type * as Types from "./types";

interface ProcessedTableData {
	tableData: unknown[];
	columns: ColumnDef<Record<string, unknown>, unknown>[];
	isEmptyArray: boolean;
}

const parseResponse = (response: string | undefined): unknown[] | null => {
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

const extractColumns = (data: unknown[]): ColumnDef<Record<string, unknown>, unknown>[] => {
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

const EmptyState = ({ message, description }: { message: string; description: string }) => (
	<div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
		<div className="text-center">
			<div className="text-lg mb-2">{message}</div>
			<div className="text-sm">{description}</div>
		</div>
	</div>
);

const ResultHeader = ({ isMaximized, onToggleMaximize }: { isMaximized: boolean; onToggleMaximize: () => void }) => (
	<div className="flex gap-1 items-center justify-between bg-bg-secondary pl-2 pr-2 py-3 border-b h-10">
		<div className="flex gap-1 items-center">
			<span className="typo-label text-text-secondary">Result:</span>
		</div>
		<Button variant="ghost" size="small" onClick={onToggleMaximize}>
			{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
		</Button>
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
	tableData: unknown[];
	columns: ColumnDef<Record<string, unknown>, unknown>[];
}) => {
	if (!rows) {
		return <EmptyState message="No results yet" description="Click Run to execute the ViewDefinition" />;
	}

	if (isEmptyArray) {
		return <EmptyState message="No results" description="The query executed successfully but returned no data" />;
	}

	if (tableData.length > 0) {
		return (
			<div className="flex-1 overflow-hidden min-h-0">
				<DataTable columns={columns as any} data={tableData} stickyHeader />
			</div>
		);
	}

	return (
		<div className="flex-1 p-4">
			<CodeEditor readOnly={true} currentValue={rows} mode="json" />
		</div>
	);
};

const ResultPagination = ({
	onPageChange,
	onPageSizeChange,
	hasResults,
	resultCount,
}: {
	onPageChange: (direction: "next" | "previous") => void;
	onPageSizeChange: (pageSize: number) => void;
	hasResults: boolean;
	resultCount: number;
}) => {
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const currentPage = viewDefinitionContext.runResultPage || 1;
	const pageSize = viewDefinitionContext.runResultPageSize || 30;

	const isLastPage = !hasResults || resultCount < pageSize;

	return (
		<div className="flex items-center justify-end bg-bg-secondary px-6 py-3 border-t h-12">
			<div className="flex items-center gap-4">
				<Pagination>
					<PaginationPageSizeSelector
						pageSize={pageSize}
						onPageSizeChange={onPageSizeChange}
						pageSizeOptions={[30, 50, 100]}
					/>
					<PaginationContent>
						<PaginationPrevious
							href="#"
							onClick={(e) => {
								e.preventDefault();
								onPageChange("previous");
							}}
							aria-disabled={currentPage <= 1}
							size="small"
							style={
								currentPage <= 1
									? {
											pointerEvents: "none",
											opacity: 0.5,
											cursor: "not-allowed",
										}
									: { cursor: "pointer" }
							}
						/>
						<PaginationNext
							href="#"
							onClick={(e) => {
								e.preventDefault();
								onPageChange("next");
							}}
							aria-disabled={isLastPage}
							size="small"
							style={
								isLastPage
									? {
											pointerEvents: "none",
											opacity: 0.5,
											cursor: "not-allowed",
										}
									: { cursor: "pointer" }
							}
						/>
					</PaginationContent>
				</Pagination>
			</div>
		</div>
	);
};

export function ResultPanel() {
	const viewDefinitionContext = useContext(ViewDefinitionContext);
	const rows = viewDefinitionContext.runResult;
	const [isMaximized, setIsMaximized] = useState(false);

	const { tableData, columns, isEmptyArray } = useMemo(() => {
		const data = processTableData(rows);
		return data;
	}, [rows]);

	const viewDefinitionRunMutation = useMutation({
		mutationFn: ({
			viewDefinition,
			page,
			pageSize,
		}: {
			viewDefinition: Types.ViewDefinition | undefined;
			page: number;
			pageSize: number;
		}) => {
			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{
						name: "viewResource",
						resource: viewDefinition,
					},
					{
						name: "_format",
						valueCode: "json",
					},
					{
						name: "_limit",
						valueInteger: pageSize,
					},
					{
						name: "_page",
						valueInteger: page,
					},
				],
			};
			return AidboxCallWithMeta({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: (data) => {
			const decodedData = atob(JSON.parse(data.body).data);
			viewDefinitionContext.setRunResult(decodedData);
		},
		onError: () => {},
	});

	const handlePageChange = (direction: "next" | "previous") => {
		const currentPage = viewDefinitionContext.runResultPage || 1;
		const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

		if (newPage < 1) return;

		viewDefinitionContext.setRunResultPage(newPage);

		if (viewDefinitionContext.runViewDefinition) {
			viewDefinitionRunMutation.mutate({
				viewDefinition: viewDefinitionContext.runViewDefinition,
				page: newPage,
				pageSize: viewDefinitionContext.runResultPageSize || 30,
			});
		}
	};

	const handlePageSizeChange = (pageSize: number) => {
		viewDefinitionContext.setRunResultPageSize(pageSize);
		viewDefinitionContext.setRunResultPage(1);

		if (viewDefinitionContext.runViewDefinition) {
			viewDefinitionRunMutation.mutate({
				viewDefinition: viewDefinitionContext.runViewDefinition,
				page: 1,
				pageSize: pageSize,
			});
		}
	};

	const toggleMaximize = () => {
		setIsMaximized((prev) => !prev);
	};

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isMaximized) {
				setIsMaximized(false);
			}
		};

		if (isMaximized) {
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isMaximized]);

	return (
		<div
			className={`flex flex-col h-full ${isMaximized ? "absolute top-0 bottom-0 h-full w-full left-0 z-30 overflow-auto bg-bg-primary" : ""}`}
		>
			<ResultHeader isMaximized={isMaximized} onToggleMaximize={toggleMaximize} />
			<ResultContent rows={rows} isEmptyArray={isEmptyArray} tableData={tableData} columns={columns} />
			{rows && (
				<ResultPagination
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
					hasResults={tableData.length > 0}
					resultCount={tableData.length}
				/>
			)}
		</div>
	);
}
