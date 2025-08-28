import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";

export function LeftMenu({ leftMenuOpen }: { leftMenuOpen: boolean }) {
	return (
		<div
			className={`w-0 invisible transition-[width] ${leftMenuOpen ? "min-w-70 w-70 visible border-r" : ""}`}
		>
			<Tabs defaultValue="history">
				<div className="border-b h-10">
					<TabsList>
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="collections">Collections</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="history" className="px-3 py-2 text-nowrap">
					todo history
				</TabsContent>
				<TabsContent value="collections" className="px-3 py-2 text-nowrap">
					todo collections
				</TabsContent>
			</Tabs>
		</div>
	);
}
