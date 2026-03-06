import {
	Label,
	Switch,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { SettingInfoPanel } from "../setting-info-panel";
import { SettingLabel } from "../setting-label";
import type { Setting } from "../types";

interface BoolSettingProps {
	setting: Setting;
	value: unknown;
	editable: boolean;
	notEditableExplanation?: string;
	onSave: (setting: Setting, value: unknown) => void;
}

export function BoolSetting({
	setting,
	value,
	editable,
	notEditableExplanation,
	onSave,
}: BoolSettingProps) {
	const [infoOpen, setInfoOpen] = useState(false);
	const checked = value === true;

	const disabledSwitch = (
		<div className="cursor-not-allowed">
			<Switch checked={checked} locked className="pointer-events-none" />
		</div>
	);

	const toggle =
		notEditableExplanation && !editable ? (
			<Tooltip>
				<TooltipTrigger asChild>{disabledSwitch}</TooltipTrigger>
				<TooltipContent>{notEditableExplanation}</TooltipContent>
			</Tooltip>
		) : !editable ? (
			disabledSwitch
		) : (
			<Switch
				checked={checked}
				onCheckedChange={(newChecked) => {
					onSave(setting, newChecked === true);
				}}
			/>
		);

	return (
		<div className="group/setting">
			<div className="flex gap-3">
				<div className="shrink-0 pt-0.5">{toggle}</div>
				<div className="min-w-0 flex-1 space-y-1.5">
					<Label className="select-text text-sm">
						<SettingLabel setting={setting} />
					</Label>

					{setting.description ? (
						<div className="flex items-start gap-2 pt-0.5">
							<div
								className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere] text-text-secondary [&_a]:text-[var(--color-elements-links)] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:whitespace-pre-wrap [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words [&_ul]:list-disc [&_ul]:pl-4"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-provided HTML descriptions
								dangerouslySetInnerHTML={{ __html: setting.description }}
							/>
							<button
								type="button"
								onClick={() => setInfoOpen((o) => !o)}
								className="invisible ml-auto inline-flex cursor-pointer shrink-0 items-center gap-1 text-xs text-text-secondary hover:text-text-primary group-hover/setting:visible"
							>
								{infoOpen ? <Minus size={14} /> : <Plus size={14} />}
								<span>{infoOpen ? "Less" : "More"}</span>
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setInfoOpen((o) => !o)}
							className="invisible flex cursor-pointer items-center gap-1 text-xs text-text-secondary hover:text-text-primary group-hover/setting:visible"
						>
							{infoOpen ? <Minus size={14} /> : <Plus size={14} />}
							<span>{infoOpen ? "Less" : "More"}</span>
						</button>
					)}

					{infoOpen && <SettingInfoPanel setting={setting} />}
				</div>
			</div>
		</div>
	);
}
