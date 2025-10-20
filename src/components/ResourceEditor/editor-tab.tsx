import * as HSComp from "@health-samurai/react-components";
import type { EditorMode } from "./types";

type EditorTabProps = {
	mode: EditorMode;
	defaultResourceText: string;
	setResourceText: (text: string) => void;
};

export const EditorTab = ({
	mode,
	defaultResourceText,
	setResourceText,
}: EditorTabProps) => {
	return (
		<div>
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
