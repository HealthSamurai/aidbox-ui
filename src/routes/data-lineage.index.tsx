import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/data-lineage/")({
	beforeLoad: () => {
		throw redirect({
			to: "/data-lineage/views",
			search: { q: undefined, page: undefined, pageSize: undefined },
		});
	},
});
