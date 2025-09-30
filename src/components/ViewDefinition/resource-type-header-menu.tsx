import type { ComboboxOption } from "@health-samurai/react-components";
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

const ResourceTypeSelect = ({
	comboboxOptions,
}: {
	comboboxOptions: ComboboxOption[];
}) => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const [open, setOpen] = React.useState(false);

	const handleOnSelect = (value: string) => {
		setOpen(false);
		if (viewDefinitionContext.viewDefinition) {
			const newViewDefinition: Types.ViewDefinition = {
				...viewDefinitionContext.viewDefinition,
				resource: value,
			};
			viewDefinitionContext.setViewDefinition(newViewDefinition);
		}
	};

	const currentResourceType = viewDefinitionContext.viewDefinition?.resource;

	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverTrigger>
				<HSComp.Button
					variant="link"
					className="text-text-secondary bg-gray-100 rounded-full px-2 h-6"
				>
					<span className="typo-body">
						{viewDefinitionContext.viewDefinition?.resource}
					</span>
					<Lucide.ChevronDownIcon />
				</HSComp.Button>
			</HSComp.PopoverTrigger>
			<HSComp.PopoverContent className="p-0">
				<HSComp.Command>
					<HSComp.CommandInput></HSComp.CommandInput>
					<HSComp.CommandList>
						{comboboxOptions.map((option) => (
							<HSComp.CommandItem
								key={option.value}
								data-state={
									currentResourceType === option.value ? "checked" : undefined
								}
								value={option.value}
								onSelect={handleOnSelect}
							>
								{option.label}
								<Lucide.CheckIcon
									className={HSComp.cn(
										"ml-auto size-4",
										currentResourceType === option.value
											? "opacity-100"
											: "opacity-0",
									)}
								/>
							</HSComp.CommandItem>
						))}
					</HSComp.CommandList>
				</HSComp.Command>
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
};

// TODO useQuery to Resource type select component
export const ResourceTypeHeaderMenu = () => {
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

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	return (
		<div className="flex items-center gap-2 bg-bg-secondary px-4 py-3 border-b">
			<span className="typo-label text-text-secondary whitespace-nowrap">
				Resource type:
			</span>
			<ResourceTypeSelect comboboxOptions={comboboxOptions} />
		</div>
	);
};
