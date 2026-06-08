import * as HSComp from "@health-samurai/react-components";
import { ArrowRightLeft, SaveIcon } from "lucide-react";

export function EditorHeaderMenu({
	onSave,
	onTranslate,
	isSaveDisabled,
	isTranslateActive,
}: {
	onSave: () => void;
	onTranslate: () => void;
	isSaveDisabled?: boolean;
	isTranslateActive?: boolean;
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
			<div className="flex items-center gap-1 px-2">
				<HSComp.Toggle
					variant="outline"
					pressed={!!isTranslateActive}
					onPressedChange={onTranslate}
				>
					<ArrowRightLeft className="w-4 h-4" />
					Translation
				</HSComp.Toggle>
			</div>
		</div>
	);
}
