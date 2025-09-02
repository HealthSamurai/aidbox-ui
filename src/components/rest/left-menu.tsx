import {
	Button,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import React from "react";

type LeftMenuStatus = "open" | "close";

const LeftMenuContext = React.createContext<LeftMenuStatus>("open");
export { LeftMenuContext };

export function LeftMenu() {
	const leftMenuStatus = React.useContext(LeftMenuContext);
	console.log("st", leftMenuStatus);
	return (
		<div
			className={`w-0 invisible transition-[width] ${leftMenuStatus === "open" ? "min-w-70 w-70 visible border-r" : ""}`}
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

type LeftMenuToggleProps = {
	onOpen: () => void;
	onClose: () => void;
};

export function LeftMenuToggle({ onOpen, onClose }: LeftMenuToggleProps) {
	const leftMenuStatus = React.useContext<LeftMenuStatus>(LeftMenuContext);

	return (
		<Tooltip delayDuration={600}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className="h-full border-b flex-shrink-0 border-r"
					onClick={leftMenuStatus === "open" ? onClose : onOpen}
				>
					{leftMenuStatus === "open" ? (
						<PanelLeftClose className="size-4" />
					) : (
						<PanelLeftOpen className="size-4" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>History / Collections</TooltipContent>
		</Tooltip>
	);
}
