import {
	Label,
	RadioGroup,
	RadioGroupItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SettingInfoPanel } from "../setting-info-panel";
import { SettingLabel } from "../setting-label";
import type { Setting } from "../types";

interface EnumSettingProps {
	setting: Setting;
	value: unknown;
	editable: boolean;
	notEditableExplanation?: string;
	onSave: (setting: Setting, value: unknown) => void;
}

export function EnumSetting({
	setting,
	value,
	editable,
	notEditableExplanation,
	onSave,
}: EnumSettingProps) {
	const [infoOpen, setInfoOpen] = useState(false);
	const variants = setting.variants ?? [];
	const hasDescriptions = variants.some((v) => v.desc);
	const currentValue = String(value ?? "");

	return (
		<div className="group/setting space-y-1">
			<div className="flex items-center justify-between">
				<Label className="text-sm">
					<SettingLabel setting={setting} />
				</Label>
				<button
					type="button"
					onClick={() => setInfoOpen((o) => !o)}
					className="invisible text-text-secondary hover:text-text-primary group-hover/setting:visible"
				>
					{infoOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</button>
			</div>

			{hasDescriptions ? (
				<RadioGroup
					value={currentValue}
					disabled={!editable}
					onValueChange={(newValue) => {
						if (editable) onSave(setting, newValue);
					}}
					className="space-y-2"
				>
					{variants.map((variant) => (
						<div key={variant.value} className="flex items-start gap-2">
							{notEditableExplanation && !editable ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="pt-0.5">
											<RadioGroupItem value={variant.value} disabled />
										</div>
									</TooltipTrigger>
									<TooltipContent>{notEditableExplanation}</TooltipContent>
								</Tooltip>
							) : (
								<RadioGroupItem value={variant.value} className="mt-0.5" />
							)}
							<div>
								<code className="text-xs">{variant.value}</code>
								{variant.desc && (
									<p
										className="text-xs text-text-secondary [&_a]:text-[var(--color-elements-links)] [&_a]:underline"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-provided HTML descriptions
										dangerouslySetInnerHTML={{ __html: variant.desc }}
									/>
								)}
							</div>
						</div>
					))}
				</RadioGroup>
			) : (
				<div>
					{notEditableExplanation && !editable ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<div>
									<Select value={currentValue} disabled>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{variants.map((v) => (
												<SelectItem key={v.value} value={v.value}>
													{v.value}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</TooltipTrigger>
							<TooltipContent>{notEditableExplanation}</TooltipContent>
						</Tooltip>
					) : (
						<Select
							value={currentValue}
							disabled={!editable}
							onValueChange={(newValue) => {
								if (editable) onSave(setting, newValue);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{variants.map((v) => (
									<SelectItem key={v.value} value={v.value}>
										{v.value}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			)}

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
