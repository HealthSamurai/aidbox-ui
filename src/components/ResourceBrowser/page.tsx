import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as Humanize from "../../humanize";
import * as Utils from "../../utils";
import type * as VDTypes from "../ViewDefinition/types";
import * as Constants from "./constants";
import type * as Types from "./types";

type FhirSchema = {
	elements: Record<string, unknown>;
	url: string;
	name: string;
	version: string;
};

interface Schema {
	differential: Array<VDTypes.Snapshot>;
	snapshot: Array<VDTypes.Snapshot>;
	entity: FhirSchema;
	"default?": boolean;
}

interface SchemaData {
	result: Record<string, Schema>;
}

const ResourcesPageContext = React.createContext<Types.ResourcesPageContext>({
	resourceType: "",
});

const ResourcesTabContentContext =
	React.createContext<Types.ResourcesTabContentContext>({
		resourcesLoading: false,
	});

export const ResourcePageTabList = () => {
	return (
		<div className="border-b w-full h-10">
			<HSComp.TabsList className="px-4">
				<HSComp.TabsTrigger value="resources">Resources</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="profiles">Profiles</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="extensions">
					Search parameters
				</HSComp.TabsTrigger>
			</HSComp.TabsList>
		</div>
	);
};

export const ResourcesTabSarchInput = () => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);

	const search = Router.useSearch({
		strict: false,
	});

	const decodedSearchQuery = search.searchQuery
		? atob(search.searchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	return (
		<HSComp.Input
			autoFocus
			type="text"
			name="searchQuery"
			defaultValue={decodedSearchQuery}
			prefixValue={
				<span className="flex gap-1 text-nowrap text-elements-assistive">
					<span className="font-bold">GET</span>
					<span>/fhir/{resourcesPageContext.resourceType}?</span>
				</span>
			}
		/>
	);
};

export const ResourcesTabCreateButton = () => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);

	return (
		<Router.Link
			to="/resource/$resourceType/create"
			params={{ resourceType: resourcesPageContext.resourceType }}
			search={{ tab: "code", mode: "json" }}
		>
			<HSComp.Button variant="secondary">
				<Lucide.PlusIcon className="text-fg-brand-primary" />
				Create
			</HSComp.Button>
		</Router.Link>
	);
};

export const ResourcesTabSearchButton = () => {
	const resourcesTabContentContext = React.useContext(
		ResourcesTabContentContext,
	);

	return (
		<HSComp.Button
			variant="primary"
			type="submit"
			disabled={resourcesTabContentContext.resourcesLoading}
		>
			Search
		</HSComp.Button>
	);
};

export const ResourcesTabHeader = ({
	handleSearch,
}: Types.ResourcesTabHeaderProps) => {
	return (
		<form className="px-4 py-3 border-b flex gap-2" onSubmit={handleSearch}>
			<ResourcesTabSarchInput />
			<div className="flex gap-4 items-center">
				<ResourcesTabSearchButton />
				<HSComp.Separator
					orientation="vertical"
					className="data-[orientation=vertical]:h-6"
				/>
				<ResourcesTabCreateButton />
			</div>
		</form>
	);
};

const fetchSchemas = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Record<string, Schema> | undefined> => {
	const response = await client.aidboxRawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			method: "aidbox.introspector/get-schemas-by-resource-type",
			params: { "resource-type": resourceType },
		}),
	});

	const data: SchemaData = await response.response.json();

	if (!data?.result) return undefined;

	return data.result;
};

const fetchDefaultSchema = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Schema | undefined> => {
	const schemas = await fetchSchemas(client, resourceType);

	if (!schemas) return undefined;

	const defaultSchema = Object.values(schemas).find(
		(schema: Schema) => schema["default?"] === true,
	);

	return defaultSchema;
};

const resourcesWithKeys = (
	profiles: Schema | undefined,
	resources: Array<Record<string, unknown>>,
) => {
	const resourceKeys: Record<string, undefined> = resources.reduce(
		(acc: Record<string, undefined>, resource: Record<string, unknown>) => {
			Object.keys(resource).forEach((key) => {
				acc[key] = undefined;
			});
			return acc;
		},
		{},
	);

	const snapshot = profiles?.entity?.elements;

	return {
		resources: resources.map((resource) => ({ ...resourceKeys, ...resource })),
		resourceKeys: Object.keys(resourceKeys).filter(
			(k) =>
				k !== "id" &&
				k !== "createdAt" &&
				k !== "lastUpdated" &&
				k !== "resourceType",
		),
		...(snapshot ? { snapshot: snapshot as Humanize.Snapshot } : {}),
	};
};

export const ResourcesTabTable = ({ data }: Types.ResourcesTabTableProps) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const resourcesTabContentContext = React.useContext(
		ResourcesTabContentContext,
	);

	if (resourcesTabContentContext.resourcesLoading) {
		return <div>Loading...</div>;
	}

	if (!data || !data.resources || data.resources.length === 0) {
		return <div>No resources found</div>;
	}

	const { resources, resourceKeys, snapshot } = data;

	const columns: HSComp.ColumnDef<Types.Resource, string>[] = [
		{
			accessorKey: "id",
			header: () => <span className="pl-5">ID</span>,
			cell: (info) => (
				<Router.Link
					className="text-text-link hover:underline pl-5"
					to="/resource/$resourceType/edit/$id"
					search={{ tab: "code", mode: "json" }}
					params={{
						resourceType: resourcesPageContext.resourceType,
						id: info.getValue(),
					}}
				>
					{info.getValue()}
				</Router.Link>
			),
		},
		{
			accessorKey: "lastUpdated",
			header: () => <span className="pl-5">lastUpdated</span>,
			cell: (info) =>
				Humanize.humanizeValue(
					"lastUpdated",
					info.row.original.meta?.lastUpdated,
					{},
				),
		},
	];

	resourceKeys.forEach((k: string) => {
		if (k !== "id" && k !== "meta")
			columns.push({
				accessorKey: k,
				header: () => <span className="pl-5">{k}</span>,
				cell: (info) =>
					Humanize.humanizeValue(k, info.getValue(), snapshot ?? {}),
			});
	});

	return (
		<div className="h-full overflow-hidden">
			<HSComp.DataTable columns={columns} data={resources} stickyHeader />
		</div>
	);
};

type FhirBundle<T> = {
	entry: { resource: T }[];
};

const ResourcesTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);

	const navigate = Router.useNavigate();
	const search = Router.useSearch({
		strict: false,
	});

	const decodedSearchQuery = search.searchQuery
		? atob(search.searchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-list", decodedSearchQuery],
		queryFn: async () => {
			const response = await client.aidboxRawRequest({
				method: "GET",
				url: `/fhir/${resourcesPageContext.resourceType}?${decodedSearchQuery}`,
			});
			const bundle: FhirBundle<Record<string, unknown>> =
				await response.response.json();

			const data = bundle.entry.map((entry) => entry.resource);
			const schema = await fetchDefaultSchema(client, resourceType);
			return resourcesWithKeys(schema, data);
		},
		retry: false,
	});

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		navigate({
			to: ".",
			search: {
				searchQuery: btoa(e.currentTarget.searchQuery.value),
			},
		});
	};

	return (
		<ResourcesTabContentContext.Provider
			value={{ resourcesLoading: isLoading }}
		>
			<ResourcesTabHeader handleSearch={handleSearch} />
			<ResourcesTabTable data={data} />
		</ResourcesTabContentContext.Provider>
	);
};

const ProfilesTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const [selectedProfile, setSelectedProfile] = React.useState<Schema | null>(
		null,
	);
	const [detailTab, setDetailTab] = React.useState<string>("differential");

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-profiles-list"],
		queryFn: async () => {
			const schema = await fetchSchemas(client, resourceType);
			return schema;
		},
		retry: false,
	});

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!data || Object.keys(data).length === 0) {
		return <div>No profiles found</div>;
	}

	const makeClickableCell = <T,>(
		renderer: (info: {
			row: { original: Schema };
			getValue: () => T;
		}) => React.ReactNode,
	) => {
		return (info: { row: { original: Schema }; getValue: () => T }) => (
			<button
				type="button"
				className="cursor-pointer"
				onClick={() => setSelectedProfile(info.row.original)}
			>
				{renderer(info)}
			</button>
		);
	};

	const columns: HSComp.ColumnDef<Schema, string>[] = [
		{
			accessorKey: "default?",
			size: 16,
			header: () => <span className="pl-5"></span>,
			cell: makeClickableCell((info) =>
				info.getValue() ? (
					<span title="default profile">
						<Lucide.Diamond size="17px" />
					</span>
				) : (
					<Lucide.Minus size="17px" />
				),
			),
		},
		{
			accessorKey: "url",
			header: () => <span className="pl-5">URL</span>,
			cell: makeClickableCell((info) => info.row.original.entity?.url || ""),
		},
		{
			accessorKey: "name",
			header: () => <span className="pl-5">Name</span>,
			cell: makeClickableCell((info) => info.row.original.entity?.name || ""),
		},
		{
			accessorKey: "version",
			header: () => <span className="pl-5">Version</span>,
			cell: makeClickableCell(
				(info) => info.row.original.entity?.version || "",
			),
		},
		{
			accessorKey: "ig",
			header: () => <span className="pl-5">IG</span>,
			cell: makeClickableCell((info) => {
				const { name, version } = info.row.original.entity;
				const ig = `${name}#${version}`;
				// <Router.Link to="/ig/$ig" params={{ ig: ig }} > {ig} </Router.Link> // FIXME when FAR in new UI
				return ig;
			}),
		},
	];

	if (!selectedProfile) {
		return (
			<div className="h-full overflow-hidden">
				<HSComp.DataTable
					columns={columns}
					data={Object.values(data)}
					stickyHeader
				/>
			</div>
		);
	}

	return (
		<div className="h-full overflow-hidden">
			<HSComp.ResizablePanelGroup
				direction="horizontal"
				autoSaveId="profiles-tab-horizontal-panel"
			>
				<HSComp.ResizablePanel minSize={30}>
					<HSComp.DataTable
						columns={columns}
						data={Object.values(data)}
						stickyHeader
					/>
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle />
				<HSComp.ResizablePanel minSize={30}>
					<div className="h-full flex flex-col">
						<div className="border-b h-10 flex items-center justify-between px-4">
							<HSComp.Tabs
								value={detailTab}
								onValueChange={setDetailTab}
								className="flex-1"
							>
								<HSComp.TabsList>
									<HSComp.TabsTrigger value="differential">
										Differential
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="snapshot">
										Snapshot
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="fhirschema">
										FHIRSchema
									</HSComp.TabsTrigger>
								</HSComp.TabsList>
							</HSComp.Tabs>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={() => setSelectedProfile(null)}
							>
								<Lucide.XIcon size={16} />
							</HSComp.Button>
						</div>
						<div className="flex-1 overflow-auto p-4">
							<HSComp.Tabs value={detailTab}>
								<HSComp.TabsContent value="differential">
									<HSComp.FhirStructureView
										tree={Utils.transformSnapshotToTree(
											selectedProfile.differential,
										)}
									/>
								</HSComp.TabsContent>
								<HSComp.TabsContent value="snapshot">
									<HSComp.FhirStructureView
										tree={Utils.transformSnapshotToTree(
											selectedProfile.snapshot,
										)}
									/>
								</HSComp.TabsContent>
								<HSComp.TabsContent value="fhirschema">
									<HSComp.CodeEditor
										readOnly
										currentValue={JSON.stringify(
											selectedProfile.entity,
											null,
											"  ",
										)}
										mode="json"
									/>
								</HSComp.TabsContent>
							</HSComp.Tabs>
						</div>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
};

type SearchParameterTableData = {
	// Not in FHIR?
	code?: string;
	name: string;
	type?: string;
	definition?: string;
	documentation?: string;
};

type SearchParamExtension = {
	url: string;
	valueCode?: string;
};

type CapabilityStatementSearchParam = {
	name: string;
	type?: string;
	definition?: string;
	documentation?: string;
	extension?: SearchParamExtension[];
};

type PartialFhirCapabilityStatement = {
	rest?: {
		searchParam?: CapabilityStatementSearchParam[];
		resource?: {
			type: string;
			searchParam?: CapabilityStatementSearchParam[];
		}[];
	}[];
};

const SearchParametersTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-search-parameters-list"],
		queryFn: async () => {
			const response = await client.aidboxRawRequest({
				method: "GET",
				url: "/fhir/metadata?include-custom-resources=true",
				headers: {
					"Content-Type": "application/json",
				},
			});

			const data = await response.response.json();
			// FIXME: validate
			return data as PartialFhirCapabilityStatement;
		},
		retry: false,
	});

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!data || !data.rest) {
		return <div>No search parameters found</div>;
	}

	const rest = data.rest.at(0) || {};

	const resourceTypeParams =
		rest.resource?.find((item) => item.type === resourceType)?.searchParam ??
		[];
	const commonParams = rest.searchParam ?? [];
	const allParams = [...resourceTypeParams, ...commonParams];

	const paramsWithCode: SearchParameterTableData[] = allParams.map((param) => {
		if (param.extension) {
			const code = param.extension.find(
				(e) =>
					e.url ===
					"https://fhir.aidbox.app/fhir/StructureDefinition/search-parameter-code",
			);
			const valueCode = code?.valueCode;
			return {
				...param,
				...(valueCode ? { code: valueCode } : {}),
			} satisfies SearchParameterTableData;
		}
		return param satisfies SearchParameterTableData;
	});

	const columns: HSComp.ColumnDef<SearchParameterTableData, string>[] = [
		{
			accessorKey: "code",
			header: () => <span className="pl-5">Code</span>,
			cell: (row) => row.getValue() || "-",
		},
		{
			accessorKey: "name",
			header: () => <span className="pl-5">Name</span>,
			cell: (row) => row.getValue() || "-",
		},
		{
			accessorKey: "type",
			header: () => <span className="pl-5">Type</span>,
			cell: (row) => row.getValue() || "-",
		},
		{
			accessorKey: "definition",
			header: () => <span className="pl-5">Definition</span>,
			cell: (row) => row.getValue() || "-",
		},
		{
			accessorKey: "documentation",
			header: () => <span className="pl-5">Description</span>,
			cell: (row) => row.getValue() || "-",
		},
	];

	return (
		<div className="h-full overflow-hidden">
			<HSComp.DataTable columns={columns} data={paramsWithCode} stickyHeader />
		</div>
	);
};

export const ResourcesPage = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs defaultValue="resources">
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources" className="overflow-hidden">
					<ResourcesTabContent client={client} resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="profiles">
					<ProfilesTabContent client={client} resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="extensions">
					<SearchParametersTabContent
						client={client}
						resourceType={resourceType}
					/>
				</HSComp.TabsContent>
			</HSComp.Tabs>
		</ResourcesPageContext.Provider>
	);
};
