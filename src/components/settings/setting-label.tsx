import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { TriangleAlert } from "lucide-react";
import type { Setting } from "./types";
import { isPendingRestart, isSetByUser } from "./utils";

export function SettingLabel({
	setting,
	hasError,
}: {
	setting: Setting;
	hasError?: boolean;
}) {
	const changedByUser = isSetByUser(setting) && !hasError;
	const pendingRestart = isPendingRestart(setting);

	return (
		<div className="flex w-full items-center justify-between">
			<span className="font-medium">
				{changedByUser ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="text-[#2278E1]">{setting.title}</span>
						</TooltipTrigger>
						<TooltipContent side="right">Changed by user</TooltipContent>
					</Tooltip>
				) : (
					setting.title
				)}
			</span>
			{pendingRestart && (
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="ml-2 text-[var(--color-illustrations-solid)]">
							<TriangleAlert size={16} />
						</span>
					</TooltipTrigger>
					<TooltipContent side="left">Requires restart</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
