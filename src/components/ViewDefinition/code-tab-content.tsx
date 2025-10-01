import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { CodeEditorMenubar } from "./code-editor-menubar";
import { ViewDefinitionContext } from "./page";

export const CodeTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);

	const codeContent = JSON.stringify(
		viewDefinitionContext.viewDefinition,
		null,
		2,
	);

	return (
		<div className="grow overflow-hidden relative">
			<div className="absolute top-2 right-3 z-10">
				<CodeEditorMenubar
					mode="json"
					onModeChange={(newMode) => {
						// Handle mode change
					}}
					textToCopy={codeContent}
					onFormat={() => {
						// Handle format
					}}
				/>
			</div>
			<HSComp.CodeEditor
				currentValue={codeContent}
				mode="json"
				//onChange={handleCodeContentChange}
				//mode={codeMode === "yaml" ? "yaml" : "json"}
			/>
		</div>
	);
};
