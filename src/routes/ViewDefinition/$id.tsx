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
	[key: string]: any; // Allow additional properties
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

	useEffect(() => {
		if (viewDefinition) {
			setCodeContent(JSON.stringify(viewDefinition, null, 2));
		}
	}, [viewDefinition]);

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
						<CodeEditor readOnly={true} currentValue="" mode="sql" />
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
	// response = `[{"id":"f769d245-a8b8-44ed-982c-498bc66659f3","birthDate":null,"gender":null},{"id":"683c19dd-2563-433e-8020-9c8cd0a3455a","birthDate":null,"gender":null},{"id":"169f0c70-5c20-4870-81d9-b1dea4ce4e77","birthDate":null,"gender":null},{"id":"ebd8ed3e-297b-4106-bcf9-4b61a8b5a70d","birthDate":null,"gender":null},{"id":"12a419de-5596-4f9d-aad1-6dcc071055fb","birthDate":null,"gender":null},{"id":"abacc2f9-1ffc-4420-9ceb-f9787a2b8969","birthDate":null,"gender":null},{"id":"bea4f6fd-2105-4a60-b7ac-c4efefdb9fe4","birthDate":null,"gender":null},{"id":"ae458f89-dd16-40bc-89cf-7bb5e7adfae2","birthDate":null,"gender":null},{"id":"eb2b12d6-a263-4be4-9ca4-494057766715","birthDate":null,"gender":null},{"id":"9536c3a6-7a23-4d2e-ac7c-bf6bf6c5761e","birthDate":null,"gender":null},{"id":"62b8435c-83e1-4ffe-a740-31e88199ee2a","birthDate":null,"gender":null},{"id":"541852cb-cbc6-4bc3-bb3d-461396ec6c47","birthDate":null,"gender":null},{"id":"6696e4b3-0747-40bf-97b7-cde51fdc6b0b","birthDate":null,"gender":null},{"id":"705b8fa0-dbef-4177-84f2-e7756878df54","birthDate":null,"gender":null},{"id":"bbedffc8-3807-494e-a954-c871954fdd7f","birthDate":null,"gender":null},{"id":"9eea029a-2e97-42fb-b2d0-503811e864f8","birthDate":null,"gender":null},{"id":"6d60cb67-97d5-428f-8f49-65c94ee6390f","birthDate":null,"gender":null},{"id":"8fd334ab-c824-4d08-9e8d-2e6073e6776b","birthDate":null,"gender":null},{"id":"4042d0db-5879-4e1e-a1b7-fb55ab27424f","birthDate":null,"gender":null},{"id":"fd3777bf-fd17-4fdb-ac4c-e4cee637d982","birthDate":null,"gender":null},{"id":"6e9b5990-2cd2-43a8-af01-4b0563363f81","birthDate":null,"gender":null},{"id":"a52ba115-0dcf-4f6e-a8fe-43091455cc98","birthDate":null,"gender":null},{"id":"d1635970-e802-4436-bc9a-4e19f5fa695a","birthDate":null,"gender":null},{"id":"c9f4642d-cc29-434f-9df7-8b93dd6e6982","birthDate":null,"gender":null},{"id":"743dddbc-fd34-4b85-8db9-2f38156f2537","birthDate":null,"gender":null},{"id":"f6aa5bfa-d64e-4c77-acf0-ae859d76ffaa","birthDate":null,"gender":null},{"id":"32128085-0999-4f6c-ae3e-c202518ef855","birthDate":null,"gender":null},{"id":"9681d526-cc21-40c6-9e89-4f867348861a","birthDate":null,"gender":null},{"id":"194c2d22-b4ee-42c5-8cf3-5eebccfef025","birthDate":null,"gender":null},{"id":"2d83fb5d-6d33-45e6-ae7e-929bdde4e011","birthDate":null,"gender":null},{"id":"32872915-4563-4b8c-9aa1-8d5361ebe8ea","birthDate":null,"gender":null},{"id":"47bf9e63-0c7f-46ef-aaa9-54c8f4be9f7a","birthDate":null,"gender":null},{"id":"073592fc-3ab4-44da-ac08-c3316af0b330","birthDate":null,"gender":null},{"id":"cd903dd2-1d54-41a6-ac8a-d30673ad4240","birthDate":null,"gender":null},{"id":"2febdc08-6a8d-401e-a982-93eab1aaa456","birthDate":null,"gender":null},{"id":"ddd7d547-fce3-4b9a-b63c-1f58d277dbac","birthDate":null,"gender":null},{"id":"87ff94e2-6396-4d55-8bdd-91eeb5bae1f2","birthDate":null,"gender":null},{"id":"0719b770-ba63-4a86-8d9e-8c3d50c7717d","birthDate":null,"gender":null},{"id":"1cab0b58-bf23-41f4-a706-94618f093f02","birthDate":null,"gender":null},{"id":"10244a6d-4c30-4a15-a391-f8fa02a0cfde","birthDate":null,"gender":null},{"id":"e57dabe5-3c9d-42e0-baac-522bb14be690","birthDate":null,"gender":null},{"id":"49ac4a82-5f96-4384-b2f1-cba50033a119","birthDate":null,"gender":null},{"id":"008abecd-ef2a-43b2-bfee-0e309b1ea7ae","birthDate":null,"gender":null},{"id":"4a65d132-8d2e-46d2-a559-509771fcd846","birthDate":null,"gender":null},{"id":"41626464-7da1-4f4d-95de-aa9cd73ad296","birthDate":null,"gender":null},{"id":"95d75879-7611-4851-9007-bdd45601f988","birthDate":null,"gender":null},{"id":"46e653b1-1550-4a13-88e4-f85b2a7688bf","birthDate":null,"gender":null},{"id":"43b609a2-af6e-4453-bdb8-8b35984257a4","birthDate":null,"gender":null},{"id":"1215fca7-09e8-465b-aafe-41b42b872180","birthDate":null,"gender":null},{"id":"7ffa935e-f677-4629-a5c0-00819743a2e6","birthDate":null,"gender":null},{"id":"510b38b2-7891-41a1-b146-7ce8ee8d3765","birthDate":null,"gender":null},{"id":"2d5471ab-00cc-4627-a55d-0c58e28181bb","birthDate":null,"gender":null},{"id":"19f87bea-8ef9-49f7-bfda-b96183ca7a89","birthDate":null,"gender":null},{"id":"e7e2f2bd-c56f-4e97-a59a-cc7f9daa9d9a","birthDate":null,"gender":null},{"id":"6f5ecf8b-2f86-4b24-bd0f-f619a53f871a","birthDate":null,"gender":null},{"id":"fd05ce2d-d65f-4e86-997d-abe650c8cbe5","birthDate":null,"gender":null},{"id":"e875325c-c3b2-4c70-a646-21a1b6e8cf3d","birthDate":null,"gender":null},{"id":"b9da2e4d-b938-45c6-8be8-446a3b1edf17","birthDate":null,"gender":null},{"id":"73f7377e-3156-4029-a63f-667edb31ecda","birthDate":null,"gender":null},{"id":"239a8113-bf21-458b-9a9c-5cc1e61e8443","birthDate":null,"gender":null},{"id":"0000b484-0020-4385-86a2-c1f4540d9f13","birthDate":null,"gender":null},{"id":"974c23ce-2d09-4119-a796-cd4f123bf022","birthDate":null,"gender":null},{"id":"ac17e287-c601-4f9a-b6b3-1520eebdd62e","birthDate":null,"gender":null},{"id":"545eb2e3-eaea-419c-9873-352d008bf968","birthDate":null,"gender":null},{"id":"0c22b887-5f5d-46df-b386-d0a5bdcf3551","birthDate":null,"gender":null},{"id":"58e336e7-a934-4a3a-808e-266328cae634","birthDate":null,"gender":"male"},{"id":"01a12c22-f97a-2804-90f6-d77b5c68387c","birthDate":"1994-09-19","gender":"male"},{"id":"2193c2e7-4d66-74c6-17c5-6d0c1c094fc2","birthDate":"2016-07-01","gender":"female"},{"id":"0337ce1a-4012-7e62-99dc-2547d449bef7","birthDate":"1992-12-16","gender":"male"},{"id":"5994d754-de6b-5333-884a-073f55fcd358","birthDate":"2019-10-21","gender":"male"},{"id":"03c85a2f-23d9-8f25-63f1-580a1bddae72","birthDate":"2002-01-13","gender":"female"},{"id":"5ab3b247-dc11-35cb-3ed6-8be889f6ccbe","birthDate":"2014-02-04","gender":"male"},{"id":"0413360c-f05b-adaf-16de-3c9dfe7170d4","birthDate":"1971-11-01","gender":"male"},{"id":"625d1b5b-21d6-b1e9-931f-bcb1d02c1b10","birthDate":"2012-09-30","gender":"female"},{"id":"04fa9220-931b-6504-1444-5523f8f25710","birthDate":"1957-09-12","gender":"female"},{"id":"88cba6af-295e-add7-7a7c-59972c18a866","birthDate":"2014-05-30","gender":"female"},{"id":"0727a41e-9a5a-184a-ab41-0b5b0f92b8b0","birthDate":"2003-07-31","gender":"male"},{"id":"9932141f-dfcc-6570-d190-c3b93efe4cf1","birthDate":"1958-06-11","gender":"female"},{"id":"095a7381-ead9-1c6f-baa5-c52460aacbb7","birthDate":"1973-02-21","gender":"female"},{"id":"b1f2eee6-4de8-8570-6bac-477571029e18","birthDate":"2005-12-21","gender":"male"},{"id":"0a1b140d-2356-5fa5-78a2-d93b9b2515e1","birthDate":"1970-01-07","gender":"female"},{"id":"0b9aa41b-0776-806f-a63e-9b79fab038d2","birthDate":"1992-10-27","gender":"female"},{"id":"0c703919-f124-44df-7450-675d37fb358e","birthDate":"1993-12-04","gender":"male"},{"id":"b492263a-3c9e-4426-9b0f-25eb493901f2","birthDate":"2006-10-28","gender":"female"},{"id":"0d1c6ecb-c44c-75b1-2c2f-55a6544ffa95","birthDate":"1959-02-12","gender":"male"},{"id":"113ed6ac-2871-bb6f-c5b4-7c3a0626b0df","birthDate":"2015-10-11","gender":"male"},{"id":"13c205be-8a87-ada8-c349-a50bd01abd8b","birthDate":"1945-01-05","gender":"male"},{"id":"cb2bf685-9d7e-8ce0-d63f-6a3641d1c128","birthDate":"2021-10-14","gender":"female"},{"id":"16bd4ef1-2437-208c-6d5d-8b624d9ed159","birthDate":"1970-01-16","gender":"female"},{"id":"edf8cb56-c62c-40cb-9b8c-94791d9b0f26","birthDate":"2016-07-01","gender":"female"},{"id":"16cd3b32-c7b3-33a1-f1e6-7cc10dd2605b","birthDate":"1951-12-26","gender":"male"},{"id":"17474491-753b-0bac-dc70-8b18c64743c3","birthDate":"2011-07-06","gender":"male"},{"id":"199bad9c-7ce6-ada6-477d-f63a43e3f7b5","birthDate":"1993-04-28","gender":"female"},{"id":"ef591f26-b6b7-632e-1dbf-abe1f8b03216","birthDate":"2011-01-12","gender":"male"},{"id":"1b36907c-f72d-7567-b34c-096a7d49bf56","birthDate":"1945-01-05","gender":"male"},{"id":"1f9016ac-9098-4065-01cf-7d9a1a24a865","birthDate":"2011-07-16","gender":"male"},{"id":"22244a0d-dee5-dd4c-c538-7563475b5b2f","birthDate":"1969-02-22","gender":"male"},{"id":"22300763-005f-4f0a-90ef-6847885c777c","birthDate":"1998-12-22","gender":"male"},{"id":"2283bae8-c824-247a-3c52-5af8f3e76496","birthDate":"1981-12-17","gender":"female"},{"id":"24551bf2-2c1f-b92a-ca86-99ed3c5f3033","birthDate":"2023-02-11","gender":"male"}] `;
	const { tableData, columns } = useMemo(() => {
		if (!response) {
			return { tableData: [], columns: [] };
		}

		try {
			const parsedResponse = JSON.parse(response);

			// Check if the response is an array (table data)
			if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
				// Extract all unique keys from all objects to create columns
				const allKeys = new Set<string>();
				parsedResponse.forEach((row) => {
					if (typeof row === "object" && row !== null) {
						Object.keys(row).forEach((key) => allKeys.add(key));
					}
				});

				// Create column definitions
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

				return { tableData: parsedResponse, columns };
			}
		} catch (error) {
			console.error("Error parsing response:", error);
		}

		return { tableData: [], columns: [] };
	}, [response]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-center bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
				<span className="typo-label text-text-secondary">
					View Definition Result:
				</span>
			</div>
			{response ? (
				tableData.length > 0 ? (
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

	// ViewDefinition state management
	const [viewDefinition, setViewDefinition] = useState<ViewDefinition | null>(
		null,
	);
	const [isLoadingViewDef, setIsLoadingViewDef] = useState(false);
	const [viewDefError, setViewDefError] = useState<string | null>(null);

	// Fetch ViewDefinition content on mount
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
