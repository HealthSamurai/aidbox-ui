import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as AidboxClient from "../../api/auth";
import { AidboxCallWithMeta } from "../../api/auth";
import * as Humanize from "../../humanize";
import * as Constants from "./constants";
import type * as Types from "./types";

interface Snapshot {
	type: string | null;
	lvl: number;
	name: string;
	path?: string;
	short?: string;
	desc?: string;
	id: string;
	"union?"?: boolean;
	min?: number | string;
	max?: number | string;
	datatype?: string;
	flags?: string[];
	"extension-url"?: string;
	"extension-coordinate"?: { label: string };
	binding?: { strength: string; valueSet: string };
	"vs-coordinate"?: {
		label: string;
		id: string;
		"package-spec": {
			name: string;
			version: string;
		};
	};
}

interface Schema {
	differential: Array<Snapshot>;
	snapshot: Array<Snapshot>;
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

const fetchSchema = async (
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

	const defaultSchema = Object.values(data.result).find(
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

export const ResourcesTabContent = ({
	resourceType,
}: Types.ResourcesPageProps) => {
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
			const schema = await fetchSchema(resourceType);
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

export const ResourcesPage = ({ resourceType }: Types.ResourcesPageProps) => {
	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs defaultValue="resources">
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources" className="overflow-hidden">
					<ResourcesTabContent resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="profiles">TODO</HSComp.TabsContent>
				<HSComp.TabsContent value="extensions">TODO</HSComp.TabsContent>
			</HSComp.Tabs>
		</ResourcesPageContext.Provider>
	);
};
