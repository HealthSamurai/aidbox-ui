import { Alert, AlertDescription } from "@health-samurai/react-components";
import { CircleAlert } from "lucide-react";
import type { Setting } from "./types";
import { isPendingRestart } from "./utils";

export function RestartRequiredAlert({ settings }: { settings: Setting[] }) {
	const hasRestart = settings.some(isPendingRestart);
	if (!hasRestart) return null;

	return (
		<Alert variant="warning" className="w-72 shadow-lg">
			<AlertDescription>
				<div className="flex items-center gap-2">
					<CircleAlert size={16} className="shrink-0" />
					<span>
						Some settings will take effect after{" "}
						<span className="font-medium">Aidbox restart</span>.
					</span>
				</div>
			</AlertDescription>
		</Alert>
	);
}
