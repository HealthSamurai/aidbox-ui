import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type {
	CodeEditorView,
	GetStructureDefinition,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { CodeEditorMenubar } from "../ViewDefinition/code-editor-menubar";
import type { EditorMode } from "./types";

type EditorTabProps = {
	mode: EditorMode;
	setMode: (m: EditorMode) => void;
	triggerFormat: () => void;
	defaultResourceText: string;
	resourceText: string;
	setResourceText: (text: string) => void;
	actions?: React.ReactNode;
	trailingActions?: React.ReactNode;
	viewCallback?: (view: CodeEditorView) => void;
	issueLineNumbers?: { line: number; message?: string }[];
	getStructureDefinition?: GetStructureDefinition;
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
	viewCallback,
	issueLineNumbers,
	getStructureDefinition,
}: EditorTabProps) => {
	return (
		<div className="flex flex-col h-full">
			{(actions || trailingActions) && (
				<div className="flex items-center justify-end bg-bg-secondary flex-none h-10 border-b px-4">
					<div className="flex items-center gap-4">
						{actions}
						{actions && trailingActions && (
							<HSComp.Separator orientation="vertical" className="h-6!" />
						)}
						{trailingActions}
					</div>
				</div>
			)}
			<div className="relative grow min-h-0">
				<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
					<CodeEditorMenubar
						mode={mode}
						onModeChange={setMode}
						textToCopy={resourceText}
						onFormat={triggerFormat}
					/>
				</div>
				<HSComp.CodeEditor
					mode={mode}
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
					viewCallback={viewCallback}
					issueLineNumbers={issueLineNumbers}
				/>
			</div>
			<HSComp.TabsContent value="json" className="relative grow min-h-0">
				<HSComp.CodeEditor
					mode="json"
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
					viewCallback={viewCallback}
					issueLineNumbers={issueLineNumbers}
					getStructureDefinition={getStructureDefinition}
				/>
			</HSComp.TabsContent>
			<HSComp.TabsContent value="yaml" className="relative grow min-h-0">
				<HSComp.CodeEditor
					mode="yaml"
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
					viewCallback={viewCallback}
					issueLineNumbers={issueLineNumbers}
					getStructureDefinition={getStructureDefinition}
				/>
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
};
