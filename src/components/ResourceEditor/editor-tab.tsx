import { defaultToastPlacement } from "@aidbox-ui/components/config";
import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import type { EditorMode } from "./types";

const FormatSelector = ({
	mode,
	setMode,
}: {
	mode: EditorMode;
	setMode: (mode: EditorMode) => void;
}) => {
	return (
		<HSComp.SegmentControl
			defaultValue={mode}
			name="code-editor-menu"
			onValueChange={(value) => setMode(value as "json" | "yaml")}
		>
			<HSComp.SegmentControlItem value="json">JSON</HSComp.SegmentControlItem>
			<HSComp.SegmentControlItem value="yaml">YAML</HSComp.SegmentControlItem>
		</HSComp.SegmentControl>
	);
};

const FormatButton = ({ triggerFormat }: { triggerFormat: () => void }) => {
	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					onClick={() => {
						triggerFormat();
						HSComp.toast.success("Formatted", defaultToastPlacement);
					}}
					title="Format code"
				>
					<Lucide.TextQuote className="w-4 h-4" />
				</HSComp.Button>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent>
				<p>Format code</p>
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
};

type EditorTabProps = {
	mode: EditorMode;
	setMode: (m: EditorMode) => void;
	triggerFormat: () => void;
	defaultResourceText: string;
	setResourceText: (text: string) => void;
};

export const EditorTab = ({
	mode,
	setMode,
	triggerFormat,
	defaultResourceText,
	setResourceText,
}: EditorTabProps) => {
	return (
		<div>
			<div className="flex items-center gap-2 h-fit border rounded-full p-2 border-border-secondary bg-bg-primary">
				<FormatSelector mode={mode} setMode={setMode} />
				<FormatButton triggerFormat={triggerFormat} />
			</div>
			<div className="relative h-full">
				<HSComp.CodeEditor
					mode={mode}
					currentValue={defaultResourceText}
					onChange={setResourceText}
				/>
			</div>
		</div>
	);
};
