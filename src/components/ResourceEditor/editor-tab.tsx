import type {
	CodeEditorView,
	ExpandValueSet,
	GetStructureDefinitions,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useVimMode } from "../../shared/vim-mode";
import {
	CodeEditorFormatButton,
	CodeEditorFormatSelect,
} from "../ViewDefinition/code-editor-menubar";
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
	getStructureDefinitions?: GetStructureDefinitions;
	expandValueSet?: ExpandValueSet;
	resourceTypeHint?: string;
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
	getStructureDefinitions,
	expandValueSet,
	resourceTypeHint,
}: EditorTabProps) => {
	const vimMode = useVimMode();
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b px-4">
				<div className="flex items-center gap-4">{actions}</div>
				<div className="flex items-center gap-2">
					<CodeEditorFormatSelect mode={mode} onModeChange={setMode} />
					<CodeEditorFormatButton onFormat={triggerFormat} />
					{trailingActions}
				</div>
			</div>
			<div className="relative grow min-h-0">
				<HSComp.CodeEditor
					mode={mode}
					defaultValue={defaultResourceText}
					currentValue={resourceText}
					onChange={setResourceText}
					viewCallback={viewCallback}
					issueLineNumbers={issueLineNumbers}
					getStructureDefinitions={getStructureDefinitions}
					expandValueSet={expandValueSet}
					vimMode={vimMode}
					resourceTypeHint={resourceTypeHint}
				/>
			</div>
		</div>
	);
};
