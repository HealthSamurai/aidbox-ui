import { Tabs, TabsList, TabsTrigger } from "@health-samurai/react-components";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { ExampleTabContent } from "./example-tab-content";
import { SchemaTabContent } from "./schema-tab-content";

export type InfoPanelTabs = "schema" | "examples";

export function InfoPanel() {
	const [activeTab, setActiveTab] = useLocalStorage<InfoPanelTabs>({
		key: `viewDefinition-infoPanel-activeTab`,
		defaultValue: "schema",
	});

	return (
		<div className="flex flex-col h-full">
			<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
				<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
					<div className="flex items-center gap-8">
						<TabsList>
							<TabsTrigger value="schema" className="px-0 mr-6">
								Resource schema
							</TabsTrigger>
							<TabsTrigger value="examples" className="px-0">
								Instance examples
							</TabsTrigger>
						</TabsList>
					</div>
				</div>
				<SchemaTabContent />
				<ExampleTabContent />
			</Tabs>
		</div>
	);
}
