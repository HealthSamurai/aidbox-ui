import { defaultToastPlacement } from "@aidbox-ui/components/config";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import type { EditorMode } from "./types";

const FormatButton = ({ triggerFormat }: { triggerFormat: () => void }) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					onClick={() => {
						triggerFormat();
						HSComp.toast.success("Formatted", defaultToastPlacement);
					}}
					title="Format code"
				>
					<Lucide.TextQuote className="w-4 h-4" />
				</HSComp.Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>Format code</p>
			</TooltipContent>
		</Tooltip>
	);
};

type EditorTabProps = {
	mode: EditorMode;
	setMode: (m: EditorMode) => void;
	triggerFormat: () => void;
	defaultResourceText: string;
	resourceText: string;
	setResourceText: (text: string) => void;
	actions?: React.ReactNode;
	trailingActions?: React.ReactNode;
};

export const EditorTab = ({
	mode,
	setMode,
	triggerFormat,
	resourceText,
	defaultResourceText,
	setResourceText,
	actions,
	trailingActions,
}: EditorTabProps) => {
	return (
		<HSComp.Tabs
			variant="tertiary"
			value={mode}
			onValueChange={(value) => setMode(value as EditorMode)}
			className="flex flex-col h-full"
		>
			<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b">
				<HSComp.TabsList className="py-0! border-b-0!">
					<HSComp.TabsTrigger value="json">JSON</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="yaml">YAML</HSComp.TabsTrigger>
				</HSComp.TabsList>
				<div className="flex items-center gap-4 px-4">
					{actions}
					<FormatButton triggerFormat={triggerFormat} />
					{trailingActions}
				</div>
			</div>
			<HSComp.TabsContent value="json" className="relative grow min-h-0">
				<HSComp.CodeEditor
					mode="json"
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
				/>
			</HSComp.TabsContent>
			<HSComp.TabsContent value="yaml" className="relative grow min-h-0">
				<HSComp.CodeEditor
					mode="yaml"
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
				/>
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
};
