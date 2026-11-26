import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/forms/packages/new")({
	validateSearch: (search) => {
		const nextSearch: { forms?: string[] } = {};
		if (Array.isArray(search.forms))
			nextSearch.forms = [
				...new Set(
					search.forms.filter(
						(id): id is string => typeof id === "string" && Boolean(id),
					),
				),
			];
		return nextSearch;
	},
	staticData: { title: "New Package" },
	loader: () => ({ breadCrumb: "New Package" }),
});
