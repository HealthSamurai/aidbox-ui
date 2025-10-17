import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as AidboxClient from "../../api/auth";
import { AidboxCallWithMeta } from "../../api/auth";
import * as Humanize from "../../humanize";
import * as Utils from "../../utils";
import type * as VDTypes from "../ViewDefinition/types";
import * as Constants from "./constants";
import type * as Types from "./types";

interface Schema {
	differential: Array<VDTypes.Snapshot>;
	snapshot: Array<VDTypes.Snapshot>;
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

	const search: any = Router.useSearch({
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
			search={{ tab: "code" }}
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
	resourceType: string,
): Promise<unknown | undefined> => {
	const response = await AidboxCallWithMeta({
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

	const data: SchemaData = JSON.parse(response.body);

	if (!data?.result) return undefined;

	return data.result;
};

const fetchDefaultSchema = async (
	resourceType: string,
): Promise<unknown | undefined> => {
	const schemas = await fetchSchemas(resourceType);

	if (!schemas) return undefined;

	const defaultSchema = Object.values(schemas).find(
		(schema: Schema) => schema["default?"] === true,
	);

	return defaultSchema;
};

const resourcesWithKeys = (
	profiles: any,
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

	const snapshot = profiles.entity.elements;

	return {
		resources: resources.map((resource) => ({ ...resourceKeys, ...resource })),
		resourceKeys: Object.keys(resourceKeys).filter(
			(k) =>
				k !== "id" &&
				k !== "createdAt" &&
				k !== "lastUpdated" &&
				k !== "resourceType",
		),
		snapshot: snapshot,
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

	const columns = [
		{
			accessorKey: "id",
			header: <span className="pl-5">ID</span>,
			cell: (info: any) => (
				<Router.Link
					className="text-text-link hover:underline pl-5"
					to="/resource/$resourceType/edit/$id"
					search={{ tab: "code" }}
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
			header: <span className="pl-5">lastUpdated</span>,
			cell: (info: any) =>
				Humanize.humanizeValue(
					"lastUpdated",
					info.row.original.meta.lastUpdated,
					{},
				),
		},
	];

	resourceKeys.forEach((k: string) => {
		if (k !== "id" && k !== "meta")
			columns.push({
				accessorKey: k,
				header: <span className="pl-5">{k}</span>,
				cell: (info: any) =>
					Humanize.humanizeValue(k, info.getValue(), snapshot),
			});
	});

	return (
		<div className="h-full overflow-hidden">
			<HSComp.DataTable
				columns={columns as any}
				data={resources}
				stickyHeader
			/>
		</div>
	);
};

const ResourcesTabContent = ({ resourceType }: Types.ResourcesPageProps) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);

	const navigate = Router.useNavigate();
	const search: any = Router.useSearch({
		strict: false,
	});

	const decodedSearchQuery = search.searchQuery
		? atob(search.searchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-list", decodedSearchQuery],
		queryFn: async () => {
			const response = await AidboxClient.AidboxCallWithMeta({
				method: "GET",
				url: `/fhir/${resourcesPageContext.resourceType}?${decodedSearchQuery}`,
			});
			const data = JSON.parse(response.body).entry.map(
				(entry: any) => entry.resource,
			);
			const schema = await fetchDefaultSchema(resourceType);
			return resourcesWithKeys(schema, data);
		},
		retry: false,
	});

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		navigate({
			search: {
				searchQuery: btoa(e.currentTarget.searchQuery.value),
			} as any,
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

const ProfilesTabContent = ({ resourceType }: Types.ResourcesPageProps) => {
	const [selectedProfile, setSelectedProfile] = React.useState<any>(null);
	const [detailTab, setDetailTab] = React.useState<string>("differential");

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-profiles-list"],
		queryFn: async () => {
			const schema = await fetchSchemas(resourceType);
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

	const makeClickableCell = (renderer: (value: any) => any) => {
		return (info: any) => (
			<div
				className="cursor-pointer"
				onClick={() => setSelectedProfile(info.row.original)}
			>
				{renderer(info.getValue())}
			</div>
		);
	};

	const columns = [
		{
			accessorKey: "default?",
			size: 16,
			header: <span className="pl-5"></span>,
			cell: makeClickableCell((value) =>
				value ? <span title="default profile">+</span> : "",
			), // FIXME: icons
		},
		{
			accessorKey: "url",
			header: <span className="pl-5">URL</span>,
			cell: makeClickableCell((value) => value || ""),
		},
		{
			accessorKey: "name",
			header: <span className="pl-5">Name</span>,
			cell: makeClickableCell((value) => value || ""),
		},
		{
			accessorKey: "version",
			header: <span className="pl-5">Version</span>,
			cell: makeClickableCell((value) => value || ""),
		},
		{
			accessorKey: "ig",
			header: <span className="pl-5">IG</span>,
			cell: makeClickableCell((_value) => ""), // TODO
		},
	];

	// Adjust column accessors to read from entity
	const columnsWithEntity = columns.map((col) => {
		if (col.accessorKey === "default?") {
			return col;
		}
		return {
			...col,
			cell: (info: any) => {
				const value = info.row.original.entity?.[col.accessorKey];
				return (
					<div
						className="cursor-pointer"
						onClick={() => setSelectedProfile(info.row.original)}
					>
						{value || ""}
					</div>
				);
			},
		};
	});

	if (!selectedProfile) {
		return (
			<div className="h-full overflow-hidden">
				<HSComp.DataTable
					columns={columnsWithEntity as any}
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
						columns={columnsWithEntity as any}
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
										tree={
											Utils.transformSnapshotToTree(
												selectedProfile.differential,
											) as any
										}
									/>
								</HSComp.TabsContent>
								<HSComp.TabsContent value="snapshot">
									<HSComp.FhirStructureView
										tree={
											Utils.transformSnapshotToTree(
												selectedProfile.snapshot,
											) as any
										}
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

export const ResourcesPage = ({ resourceType }: Types.ResourcesPageProps) => {
	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs defaultValue="resources">
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources" className="overflow-hidden">
					<ResourcesTabContent resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="profiles">
					<ProfilesTabContent resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="extensions">TODO</HSComp.TabsContent>
			</HSComp.Tabs>
		</ResourcesPageContext.Provider>
	);
};
