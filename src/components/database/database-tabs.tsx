import * as HSComp from "@health-samurai/react-components";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { RunningQueries } from "./running-queries";
import { SchemaExplorer } from "./schema-explorer";
import { SearchParamsStats } from "./search-params-stats";

export function DatabaseTabs() {
	const navigate = useNavigate();
	const search = useSearch({ strict: false });
	const currentTab = (search as { tab?: string }).tab || "schema";

	const handleTabChange = (value: string) => {
		navigate({ to: "/database", search: { tab: value } });
	};

	return (
		<HSComp.Tabs value={currentTab} onValueChange={handleTabChange}>
			<div className="border-b w-full h-10">
				<HSComp.TabsList className="px-4">
					<HSComp.TabsTrigger value="schema">
						Schema explorer
					</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="queries">
						Running queries
					</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="search-params">
						Search params stats
					</HSComp.TabsTrigger>
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="schema" className="overflow-hidden">
				<SchemaExplorer />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="queries" className="overflow-hidden">
				<RunningQueries />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="search-params" className="overflow-hidden">
				<SearchParamsStats />
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
}
