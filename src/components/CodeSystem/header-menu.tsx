import * as HSComp from "@health-samurai/react-components";
import { SaveIcon } from "lucide-react";

export function EditorHeaderMenu({
	onSave,
	isSaveDisabled,
}: {
	onSave: () => void;
	isSaveDisabled?: boolean;
}) {
	return (
		<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b">
			<div className="flex items-center gap-4 px-4">
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					onClick={onSave}
					disabled={isSaveDisabled}
				>
					<SaveIcon className="w-4 h-4" />
					Save
				</HSComp.Button>
			</div>
		</div>
	);
}
