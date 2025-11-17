import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Constants from "./constants";
import { ViewDefinitionResourceTypeContext } from "./page";
import type * as Types from "./types";

const fetchResourceTypes = async (client: AidboxClientR5) => {
	return (
		await client.aidboxRequest<Types.ResourceTypesResponse>({
			method: "GET",
			url: "/$resource-types",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		})
	).response.body;
};

export const ResourceTypeSelect = () => {
	const client = useAidboxClient();

	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const { data, isLoading } = useQuery({
		queryKey: [Constants.PageID, "resource-types"],
		queryFn: async () => await fetchResourceTypes(client),
		refetchOnWindowFocus: false,
	});

	const comboboxOptions = React.useMemo(
		() =>
			Object.keys(data || {}).map((resourceType) => ({
				value: resourceType,
				label: resourceType,
			})),
		[data],
	);

	const currentResourceType =
		viewDefinitionResourceTypeContext.viewDefinitionResourceType;

	const handleOnSelect = React.useCallback(
		(value: string) => {
			if (currentResourceType) {
				viewDefinitionResourceTypeContext.setViewDefinitionResourceType(value);
			}
		},
		[
			currentResourceType,
			viewDefinitionResourceTypeContext.setViewDefinitionResourceType,
		],
	);

	if (isLoading)
		return <HSComp.Skeleton className="rounded-full min-w-21 h-6" />;

	return (
		<HSComp.ButtonDropdown
			options={comboboxOptions}
			onSelectItem={handleOnSelect}
			{...(currentResourceType ? { selectedValue: currentResourceType } : {})}
		/>
	);
};
