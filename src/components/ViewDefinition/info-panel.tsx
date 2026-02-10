import { IconButton } from "@health-samurai/react-components";
import { XIcon } from "lucide-react";
import { ExampleTabContent } from "./example-tab-content";

export function InfoPanel({ onClose }: { onClose: () => void }) {
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10! min-h-10 shrink-0">
				<span className="typo-label text-text-secondary">Instances</span>
				<IconButton
					variant="ghost"
					aria-label="Close instance preview"
					icon={<XIcon className="w-4 h-4" />}
					onClick={onClose}
				/>
			</div>
			<ExampleTabContent />
		</div>
	);
}
