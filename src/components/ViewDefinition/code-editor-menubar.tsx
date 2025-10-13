import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import type * as Types from "./types";

export const CodeEditorFormatSelect = ({
	mode,
	onModeChange,
}: {
	mode: Types.ViewDefinitionEditorMode;
	onModeChange: (mode: Types.ViewDefinitionEditorMode) => void;
}) => {
	return (
		<HSComp.SegmentControl
			defaultValue={mode}
			name="code-editor-menu"
			onValueChange={(value) => onModeChange(value as "json" | "yaml")}
		>
			<HSComp.SegmentControlItem value="json">JSON</HSComp.SegmentControlItem>
			<HSComp.SegmentControlItem value="yaml">YAML</HSComp.SegmentControlItem>
		</HSComp.SegmentControl>
	);
};

export const CodeEditorFormatButton = ({ onFormat }: { onFormat: () => void }) => {
	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>
				<HSComp.Button variant="ghost" size="small" onClick={onFormat} title="Format code">
					<Lucide.TextQuote className="w-4 h-4" />
				</HSComp.Button>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent>
				<p>Format code</p>
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
};

export const CodeEditorCopyButton = ({ textToCopy }: { textToCopy: string }) => {
	return (
		<HSComp.Button variant="ghost" size="small" asChild>
			<HSComp.CopyIcon text={textToCopy} />
		</HSComp.Button>
	);
};

export const CodeEditorMenubar = ({
	mode,
	onModeChange,
	textToCopy,
	onFormat,
}: {
	mode: Types.ViewDefinitionEditorMode;
	onModeChange: (mode: Types.ViewDefinitionEditorMode) => void;
	textToCopy: string;
	onFormat: () => void;
}) => {
	return (
		<div className="flex items-center gap-2 h-fit border rounded-full p-2 border-border-secondary bg-bg-primary">
			<CodeEditorFormatSelect mode={mode} onModeChange={onModeChange} />
			<CodeEditorFormatButton onFormat={onFormat} />
			<CodeEditorCopyButton textToCopy={textToCopy} />
		</div>
	);
};
