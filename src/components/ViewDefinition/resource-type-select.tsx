import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import React from "react";
import { AidboxCall } from "../../api/auth";
import * as Constants from "./constants";
import { ViewDefinitionResourceTypeContext } from "./page";
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
	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const { data, isLoading } = useQuery({
		queryKey: [Constants.PageID, "resource-types"],
		queryFn: async () => await fetchResourceTypes(),
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
