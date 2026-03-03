import {
	Checkbox,
	Label,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { ChevronDown, ChevronUp } from "lucide-react";
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

	return (
		<div className="group/setting space-y-1">
			<Label className="text-sm">
				<SettingLabel setting={setting} />
			</Label>

			<div className="flex items-center gap-2">
				{notEditableExplanation && !editable ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<div>
								<Checkbox checked={checked} disabled />
							</div>
						</TooltipTrigger>
						<TooltipContent>{notEditableExplanation}</TooltipContent>
					</Tooltip>
				) : (
					<Checkbox
						checked={checked}
						disabled={!editable}
						onCheckedChange={(newChecked) => {
							if (editable) {
								onSave(setting, newChecked === true);
							}
						}}
					/>
				)}
				<button
					type="button"
					onClick={() => setInfoOpen((o) => !o)}
					className="invisible text-text-secondary hover:text-text-primary group-hover/setting:visible"
				>
					{infoOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</button>
			</div>

			{setting.description && (
				<p
					className="text-xs text-text-secondary [&_a]:text-[var(--color-elements-links)] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-provided HTML descriptions
					dangerouslySetInnerHTML={{ __html: setting.description }}
				/>
			)}

			{infoOpen && <SettingInfoPanel setting={setting} />}
		</div>
	);
}
