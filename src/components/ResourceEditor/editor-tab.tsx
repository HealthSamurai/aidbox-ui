import * as HSComp from "@health-samurai/react-components";
import type { EditorMode } from "./types";

type EditorTabProps = {
	mode: EditorMode;
	resourceText: string;
	setResourceText: (text: string) => void;
};

export const EditorTab = ({
	mode,
	resourceText,
	setResourceText,
}: EditorTabProps) => {
	return (
		<div>
			<div className="relative h-full">
				<HSComp.CodeEditor
					mode={mode}
					currentValue={resourceText}
					onChange={setResourceText}
				/>
			</div>
		</div>
	);
};
