import {
	Button,
	Input,
	Label,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { SENSITIVE_PLACEHOLDER } from "../constants";
import { SettingInfoPanel } from "../setting-info-panel";
import { SettingLabel } from "../setting-label";
import type { Setting } from "../types";
import { overrideSettingValue, removeNonDigits } from "../utils";

interface TextSettingProps {
	setting: Setting;
	value: unknown;
	editable: boolean;
	notEditableExplanation?: string;
	errorMessage?: string;
	isConfirming: boolean;
	onValueChange: (name: string, value: unknown) => void;
	onSave: (setting: Setting, value: unknown) => void;
	onCancel: (setting: Setting) => void;
	onClearError: (name: string) => void;
}

export function TextSetting({
	setting,
	value,
	editable,
	notEditableExplanation,
	errorMessage,
	isConfirming,
	onValueChange,
	onSave,
	onCancel,
	onClearError,
}: TextSettingProps) {
	const [infoOpen, setInfoOpen] = useState(false);
	const isTextarea = String(setting.value ?? "").includes("\n");
	const isNumber = setting.type === "int";
	const displayValue = String(overrideSettingValue(setting, value) ?? "");
	const unit = setting.unit && setting.unit !== "1" ? setting.unit : undefined;
	const isSensitive =
		setting.sensitive && displayValue === SENSITIVE_PLACEHOLDER;

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onClearError(setting.name);
			let newValue: unknown = e.target.value;
			if (isNumber) {
				const digits = removeNonDigits(e.target.value);
				if (digits === String(value)) return;
				newValue = digits === "" ? "" : Number.parseInt(digits, 10);
			}
			onValueChange(setting.name, newValue);
		},
		[setting.name, value, isNumber, onValueChange, onClearError],
	);

	const InputComponent = isTextarea ? Textarea : Input;

	const inputField = (
		<div>
			{notEditableExplanation && !editable ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<div>
							<InputComponent
								value={isSensitive ? "" : displayValue}
								disabled
								className="text-sm"
								placeholder={isSensitive ? SENSITIVE_PLACEHOLDER : undefined}
								{...(isTextarea
									? {}
									: { suffix: unit, type: isSensitive ? "password" : "text" })}
							/>
						</div>
					</TooltipTrigger>
					<TooltipContent>{notEditableExplanation}</TooltipContent>
				</Tooltip>
			) : (
				<InputComponent
					value={displayValue}
					disabled={!editable}
					onChange={handleChange}
					invalid={!!errorMessage}
					className="text-sm"
					{...(isTextarea ? {} : { suffix: unit })}
				/>
			)}
		</div>
	);

	const descriptionBlock = setting.description ? (
		<div className="flex items-start gap-2 pt-1">
			<div
				className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere] text-text-secondary [&_a]:text-[var(--color-elements-links)] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:whitespace-pre-wrap [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words [&_ul]:list-disc [&_ul]:pl-4"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-provided HTML descriptions, matching sansara behavior
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
	);

	const isEditing = isConfirming && editable;

	return (
		<div className="group/setting">
			<div
				className={`rounded-md border px-3 py-3 ${isEditing ? "border-border-secondary" : "border-transparent"}`}
			>
				<div className="space-y-1">
					<Label className="select-text text-sm">
						<SettingLabel setting={setting} hasError={!!errorMessage} />
					</Label>
					{inputField}
					{errorMessage && (
						<p className="mt-1 text-xs text-text-error-primary">
							{errorMessage}
						</p>
					)}
					{descriptionBlock}
					{infoOpen && <SettingInfoPanel setting={setting} />}
				</div>
				{isEditing && (
					<div className="-mx-3 mt-4 border-t border-border-secondary">
						<div className="flex justify-end gap-2 px-3 pt-3">
							<Button variant="ghost" onClick={() => onCancel(setting)}>
								Cancel
							</Button>
							<Button
								disabled={setting["required?"] && displayValue === ""}
								onClick={() => onSave(setting, value)}
							>
								Save
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
