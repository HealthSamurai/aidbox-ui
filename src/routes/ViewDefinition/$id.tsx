import {
	Button,
	CodeEditor,
	type ColumnDef,
	DataTable,
	PlayIcon,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { AidboxCall, AidboxCallWithMeta } from "../../api/auth";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface ViewDefinition {
	resourceType: string;
	id?: string;
	name?: string;
	status?: string;
	resource?: string;
	description?: string;
	select?: Array<{
		column?: Array<{
			name?: string;
			path?: string;
			type?: string;
		}>;
	}>;
	[key: string]: any;
}

export const Route = createFileRoute("/ViewDefinition/$id")({
	component: ViewDefinitionPage,
	staticData: {
		title: "View Definitions",
	},
});

function LeftPanel({
	onRunResponse,
	routeId,
	setRunResponseVersion,
	viewDefinition,
	isLoadingViewDef,
	viewDefError,
	onViewDefinitionUpdate,
}: {
	onRunResponse: (response: string | null) => void;
	routeId: string;
	setRunResponseVersion: (version: string) => void;
	viewDefinition: ViewDefinition | null;
	isLoadingViewDef: boolean;
	viewDefError: string | null;
	onViewDefinitionUpdate: (viewDef: ViewDefinition) => void;
}) {
	const [activeTab, setActiveTab] = useLocalStorage<"form" | "code" | "sql">({
		key: `viewDefinition-leftPanel-activeTab-${routeId}`,
		defaultValue: "form",
	});
	const [codeContent, setCodeContent] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [sqlContent, setSqlContent] = useState("");
	const [isLoadingSQL, setIsLoadingSQL] = useState(false);

	useEffect(() => {
		if (viewDefinition) {
			setCodeContent(JSON.stringify(viewDefinition, null, 2));
		}
	}, [viewDefinition]);

	useEffect(() => {
		const fetchSQL = async () => {
			if (activeTab === "sql" && viewDefinition) {
				setIsLoadingSQL(true);
				try {
					const parametersPayload = {
						resourceType: "Parameters",
						parameter: [
							{
								name: "viewResource",
								resource: viewDefinition,
							},
						],
					};

					const response = await AidboxCallWithMeta({
						method: "POST",
						url: "/fhir/ViewDefinition/$sql",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/fhir+json",
						},
						body: JSON.stringify(parametersPayload),
					});

					try {
						const json = JSON.parse(response.body);
						if (json.issue) {
							setSqlContent(
								`-- Error: ${json.issue[0]?.diagnostics || "Unknown error"}`,
							);
						} else if (json.parameter && json.parameter[0]?.valueString) {
							try {
								const formattedSQL = formatSQL(json.parameter[0].valueString, {
									language: "postgresql",
									keywordCase: "upper",
									linesBetweenQueries: 2,
								});
								setSqlContent(formattedSQL);
							} catch (formatError) {
								setSqlContent(json.parameter[0].valueString);
							}
						} else {
							setSqlContent(response.body);
						}
					} catch {
						setSqlContent(response.body);
					}
				} catch (error) {
					console.error("Error fetching SQL:", error);
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error occurred";
					setSqlContent(`-- Error fetching SQL: ${errorMessage}`);
				} finally {
					setIsLoadingSQL(false);
				}
			}
		};

		fetchSQL();
	}, [activeTab, viewDefinition]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			let viewDefinition: any;
			try {
				viewDefinition = JSON.parse(codeContent);
			} catch (parseError) {
				console.error("Invalid JSON in code editor:", parseError);
				onRunResponse(
					JSON.stringify({ error: "Invalid JSON in code editor" }, null, 2),
				);
				setIsSaving(false);
				return;
			}

			const response = await AidboxCallWithMeta({
				method: "PUT",
				url: `/fhir/ViewDefinition/${routeId}`,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(viewDefinition),
			});

			try {
				const parsedBody = JSON.parse(response.body);
				onRunResponse(JSON.stringify({ saved: true, ...parsedBody }, null, 2));
				onViewDefinitionUpdate(parsedBody);
			} catch {
				onRunResponse(response.body);
			}
		} catch (error) {
			console.error("Error saving ViewDefinition:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			onRunResponse(JSON.stringify({ error: errorMessage }, null, 2));
		} finally {
			setIsSaving(false);
		}
	};

	const handleRun = async () => {
		setIsLoading(true);
		try {
			let viewDefinition: any;
			try {
				viewDefinition = JSON.parse(codeContent);
			} catch (parseError) {
				console.error("Invalid JSON in code editor:", parseError);
				onRunResponse(
					JSON.stringify({ error: "Invalid JSON in code editor" }, null, 2),
				);
				setIsLoading(false);
				return;
			}

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
				],
			};

			const response = await AidboxCallWithMeta({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});

			try {
				let parsedBody: any;
				const json = JSON.parse(response.body);
				if (json.data && typeof json.data === "string") {
					try {
						const decoded = atob(json.data);
						parsedBody = JSON.parse(decoded);
					} catch {
						parsedBody = json.data;
					}
				} else {
					parsedBody = json.data;
				}
				onRunResponse(JSON.stringify(parsedBody, null, 2));
			} catch {
				onRunResponse(response.body);
			}
		} catch (error) {
			console.error("Error running ViewDefinition:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			onRunResponse(JSON.stringify({ error: errorMessage }, null, 2));
		} finally {
			setRunResponseVersion(crypto.randomUUID());
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<Tabs
				value={activeTab}
				onValueChange={(value) =>
					setActiveTab(value as "form" | "code" | "sql")
				}
			>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
					<div className="flex items-center gap-8">
						<span className="typo-label text-text-secondary">
							View Definition:
						</span>
						<TabsList>
							<TabsTrigger value="form" className="px-0 mr-6">
								Form
							</TabsTrigger>
							<TabsTrigger value="code" className="px-0 mr-6">
								Code
							</TabsTrigger>
							<TabsTrigger value="sql" className="px-0">
								SQL
							</TabsTrigger>
						</TabsList>
					</div>
				</div>
				<div className="flex flex-col grow min-h-0">
					<TabsContent value="form" className="grow min-h-0">
						<div className="p-4">
							<p className="text-text-secondary">Form content goes here</p>
						</div>
					</TabsContent>
					<TabsContent value="code" className="grow min-h-0">
						{isLoadingViewDef ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Loading ViewDefinition...</div>
									<div className="text-sm">Fetching content from Aidbox</div>
								</div>
							</div>
						) : (
							<CodeEditor
								currentValue={codeContent}
								onChange={(value) => setCodeContent(value || "")}
								mode="json"
							/>
						)}
					</TabsContent>
					<TabsContent value="sql" className="grow min-h-0">
						{isLoadingSQL ? (
							<div className="flex items-center justify-center h-full text-text-secondary">
								<div className="text-center">
									<div className="text-lg mb-2">Loading SQL...</div>
									<div className="text-sm">
										Generating SQL query from ViewDefinition
									</div>
								</div>
							</div>
						) : (
							<CodeEditor
								readOnly={true}
								currentValue={sqlContent}
								mode="sql"
							/>
						)}
					</TabsContent>
				</div>
				<div className="border-t p-3 flex justify-end gap-2">
					<Button variant="secondary" onClick={handleSave} disabled={isSaving}>
						<Save className="w-4 h-4" />
						Save
					</Button>
					<Button variant="primary" onClick={handleRun} disabled={isLoading}>
						<PlayIcon />
						Run
					</Button>
				</div>
			</Tabs>
		</div>
	);
}

function RightPanel({
	routeId,
	viewDefinition,
	isLoadingViewDef,
}: {
	routeId: string;
	viewDefinition: ViewDefinition | null;
	isLoadingViewDef: boolean;
}) {
	const [activeTab, setActiveTab] = useLocalStorage<"schema" | "examples">({
		key: `viewDefinition-rightPanel-activeTab-${routeId}`,
		defaultValue: "schema",
	});

	const resourceType = viewDefinition?.resource || "Patient";

	return (
		<div className="flex flex-col h-full">
			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as "schema" | "examples")}
			>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
					<div className="flex items-center gap-8">
						<span className="typo-label text-text-secondary">Resource:</span>
						<TabsList>
							<TabsTrigger value="schema" className="px-0 mr-6">
								Schema
							</TabsTrigger>
							<TabsTrigger value="examples" className="px-0">
								Instance Examples
							</TabsTrigger>
						</TabsList>
					</div>
				</div>
				<TabsContent value="schema">
					{isLoadingViewDef ? (
						<div className="flex items-center justify-center h-full text-text-secondary">
							<div className="text-center">
								<div className="text-lg mb-2">Loading schema...</div>
								<div className="text-sm">Fetching {resourceType} schema</div>
							</div>
						</div>
					) : (
						<CodeEditor
							readOnly
							defaultValue={JSON.stringify(
								{
									resourceType,
									description: `Schema for ${resourceType} resource`,
									properties: viewDefinition?.select?.[0]?.column || [],
								},
								null,
								2,
							)}
							mode="json"
						/>
					)}
				</TabsContent>
				<TabsContent value="examples">
					{isLoadingViewDef ? (
						<div className="flex items-center justify-center h-full text-text-secondary">
							<div className="text-center">
								<div className="text-lg mb-2">Loading examples...</div>
								<div className="text-sm">Fetching {resourceType} examples</div>
							</div>
						</div>
					) : (
						<CodeEditor
							readOnly
							defaultValue={JSON.stringify(
								{
									resourceType,
									examples: [
										`Example ${resourceType} instances would be shown here`,
									],
								},
								null,
								2,
							)}
							mode="json"
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function BottomPanel({
	response,
	version,
}: {
	response: string | null;
	version: string;
}) {
	const { tableData, columns, isEmptyArray } = useMemo(() => {
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
			console.error("Error parsing response:", error);
		}

		return { tableData: [], columns: [], isEmptyArray: false };
	}, [response]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-center bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
				<span className="typo-label text-text-secondary">
					View Definition Result:
				</span>
			</div>
			{response ? (
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
						<DataTable columns={columns} data={tableData} key={version} />
					</div>
				) : (
					<div className="flex-1 p-4">
						<CodeEditor readOnly={true} currentValue={response} mode="json" />
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

function ViewDefinitionPage() {
	const { id } = Route.useParams();
	const [runResponse, setRunResponse] = useState<string | null>(null);
	const [runResponseVersion, setRunResponseVersion] = useState<string>(
		crypto.randomUUID(),
	);

	const [viewDefinition, setViewDefinition] = useState<ViewDefinition | null>(
		null,
	);
	const [isLoadingViewDef, setIsLoadingViewDef] = useState(false);
	const [viewDefError, setViewDefError] = useState<string | null>(null);

	useEffect(() => {
		const fetchViewDefinition = async () => {
			setIsLoadingViewDef(true);
			setViewDefError(null);
			try {
				const fetchedViewDefinition = await AidboxCall<ViewDefinition>({
					method: "GET",
					url: `/fhir/ViewDefinition/${id}`,
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
				});

				if (fetchedViewDefinition) {
					setViewDefinition(fetchedViewDefinition);
				}
			} catch (error) {
				console.error("Error fetching ViewDefinition:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error occurred";
				setViewDefError(`Failed to fetch ViewDefinition: ${errorMessage}`);
				setRunResponse(
					JSON.stringify(
						{ error: `Failed to fetch ViewDefinition: ${errorMessage}` },
						null,
						2,
					),
				);
			} finally {
				setIsLoadingViewDef(false);
			}
		};

		if (id) {
			fetchViewDefinition();
		}
	}, [id]);

	return (
		<div className="flex flex-col h-full">
			<ResizablePanelGroup
				direction="vertical"
				className="grow"
				autoSaveId={`view-definition-vertical-${id}`}
			>
				<ResizablePanel defaultSize={70} className="min-h-[200px]">
					<ResizablePanelGroup
						direction="horizontal"
						className="h-full"
						autoSaveId={`view-definition-horizontal-${id}`}
					>
						<ResizablePanel defaultSize={50} className="min-w-[200px]">
							<LeftPanel
								onRunResponse={setRunResponse}
								routeId={id}
								setRunResponseVersion={setRunResponseVersion}
								viewDefinition={viewDefinition}
								isLoadingViewDef={isLoadingViewDef}
								viewDefError={viewDefError}
								onViewDefinitionUpdate={setViewDefinition}
							/>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={50} className="min-w-[200px]">
							<RightPanel
								routeId={id}
								viewDefinition={viewDefinition}
								isLoadingViewDef={isLoadingViewDef}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={30} className="min-h-[150px]">
					<BottomPanel response={runResponse} version={runResponseVersion} />
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
