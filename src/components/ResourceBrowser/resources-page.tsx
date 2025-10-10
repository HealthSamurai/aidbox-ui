import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as AidboxClient from "../../api/auth";
import * as Constants from "./constants";
import type * as Types from "./types";

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

	return (
		<HSComp.Input
			autoFocus
			type="text"
			name="searchQuery"
			defaultValue="_count=30&_page=1&_ilike="
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
			to={`/resource-types/${resourcesPageContext.resourceType}/new`}
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

export const ResourcesTabTable = ({
	resources,
}: Types.ResourcesTabTableProps) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const resourcesTabContentContext = React.useContext(
		ResourcesTabContentContext,
	);

	const columns = [
		{
			accessorKey: "id",
			header: <span className="pl-5">ID</span>,
			cell: (info) => (
				<Router.Link
					className="text-text-link hover:underline pl-5"
					to={`/resource-types/${resourcesPageContext.resourceType}/${info.getValue()}`}
				>
					{info.getValue()}
				</Router.Link>
			),
		},
	];

	if (resourcesTabContentContext.resourcesLoading) {
		return <div>Loading...</div>;
	}

	if (!resources || resources.length === 0) {
		return <div>No resources found</div>;
	}

	return <HSComp.DataTable columns={columns} data={resources} stickyHeader />;
};

export const ResourcesTabContent = () => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const [searchQuery, setSearchQuery] = React.useState("");

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-list", searchQuery],
		queryFn: async () => {
			const response = await AidboxClient.AidboxCallWithMeta({
				method: "GET",
				url: `/fhir/${resourcesPageContext.resourceType}?${searchQuery}`,
			});
			return JSON.parse(response.body).entry.map(
				(entry: any) => entry.resource,
			);
		},
		retry: false,
	});

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSearchQuery(e.currentTarget.searchQuery.value);
	};

	return (
		<ResourcesTabContentContext.Provider
			value={{ resourcesLoading: isLoading }}
		>
			<ResourcesTabHeader handleSearch={handleSearch} />
			<ResourcesTabTable resources={data} />
		</ResourcesTabContentContext.Provider>
	);
};

export const ResourcesPage = ({ resourceType }: Types.ResourcesPageProps) => {
	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs defaultValue="resources">
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources">
					<ResourcesTabContent />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="profiles">TODO</HSComp.TabsContent>
				<HSComp.TabsContent value="extensions">TODO</HSComp.TabsContent>
			</HSComp.Tabs>
		</ResourcesPageContext.Provider>
	);
};
