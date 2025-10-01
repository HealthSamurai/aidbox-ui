import { Tabs } from "@health-samurai/react-components";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { ExampleTabContent } from "./example-tab-content";
import { InfoPanelTabs } from "./info-panel-tabs";
import { SchemaTabContent } from "./schema-tab-content";

export function InfoPanel() {
	const [activeTab, setActiveTab] = useLocalStorage<"schema" | "examples">({
		key: `viewDefinition-infoPanel-activeTab`,
		defaultValue: "schema",
	});

	return (
		<div className="flex flex-col h-full">
			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as "schema" | "examples")}
			>
				<InfoPanelTabs />
				<SchemaTabContent activeTab={activeTab} />
				<ExampleTabContent activeTab={activeTab} />
			</Tabs>
		</div>
	);
}
