import { TabsList, TabsTrigger } from "@health-samurai/react-components";

export function InfoPanelTabs() {
	return (
		<div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
			<div className="flex items-center gap-8">
				<span className="typo-label text-text-secondary">Resource:</span>
				<TabsList>
					<TabsTrigger value="schema" className="px-0 mr-6">
						Schema
					</TabsTrigger>
					<TabsTrigger value="examples" className="px-0">
						Instance Examples
					</TabsTrigger>
				</TabsList>
			</div>
		</div>
	);
}
