import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import React from "react";
import { AidboxCall } from "../../api/auth";
import * as Constants from "./constants";
import { ViewDefinitionContext } from "./page";
import type * as Types from "./types";

const fetchResourceTypes = () => {
	return AidboxCall<Types.ResourceTypesResponse>({
		method: "GET",
		url: "/$resource-types",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});
};

export const ResourceTypeSelect = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);

	const { data, isLoading, error } = useQuery({
		queryKey: [Constants.PageID, "resource-types"],
		queryFn: async () => await fetchResourceTypes(),
	});

	const comboboxOptions = React.useMemo(
		() =>
			Object.keys(data || {}).map((resourceType) => ({
				value: resourceType,
				label: resourceType,
			})),
		[data],
	);

	const handleOnSelect = React.useCallback(
		(value: string) => {
			if (viewDefinitionContext.viewDefinition) {
				const newViewDefinition: Types.ViewDefinition = {
					...viewDefinitionContext.viewDefinition,
					resource: value,
				};
				viewDefinitionContext.setViewDefinition(newViewDefinition);
			}
		},
		[
			viewDefinitionContext.viewDefinition,
			viewDefinitionContext.setViewDefinition,
		],
	);

	console.log(
		"RE_RENDER ResourceTypeSelect",
		viewDefinitionContext.setViewDefinition,
	);

	const currentResourceType = viewDefinitionContext.viewDefinition?.resource;

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	return (
		<HSComp.ButtonDropdown
			options={comboboxOptions}
			onSelectItem={handleOnSelect}
			{...(currentResourceType ? { selectedValue: currentResourceType } : {})}
		/>
	);
};
