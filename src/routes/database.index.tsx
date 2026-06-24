import { createFileRoute } from "@tanstack/react-router";
import { DatabaseTabs } from "../components/database/database-tabs";

export const Route = createFileRoute("/database/")({
	validateSearch: (search: Record<string, unknown>): { tab?: string } =>
		typeof search.tab === "string" ? { tab: search.tab } : {},
	component: DatabaseTabs,
});
