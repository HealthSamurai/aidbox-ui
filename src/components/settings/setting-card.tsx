import { BoolSetting } from "./setting-controls/bool-setting";
import { EnumSetting } from "./setting-controls/enum-setting";
import { TextSetting } from "./setting-controls/text-setting";
import type { Setting } from "./types";
import {
	getNotEditableExplanation,
	getSettingValue,
	isPendingRestart,
	isSettingEditable,
} from "./utils";

interface SettingCardProps {
	setting: Setting;
	isDebugMode: boolean;
	pendingValue?: unknown;
	isConfirming: boolean;
	errorMessage?: string;
	onValueChange: (name: string, value: unknown) => void;
	onSave: (setting: Setting, value: unknown) => void;
	onCancel: (setting: Setting) => void;
	onClearError: (name: string) => void;
	onImmediateSave: (setting: Setting, value: unknown) => void;
}

export function SettingCard({
	setting,
	isDebugMode,
	pendingValue,
	isConfirming,
	errorMessage,
	onValueChange,
	onSave,
	onCancel,
	onClearError,
	onImmediateSave,
}: SettingCardProps) {
	const editable = isSettingEditable(setting, isDebugMode);
	const notEditableExplanation = getNotEditableExplanation(
		setting,
		isDebugMode,
	);
	const pendingRestart = isPendingRestart(setting);

	const displayValue =
		pendingValue !== undefined ? pendingValue : getSettingValue(setting);

	let content: React.ReactNode;

	switch (setting.type) {
		case "bool":
			content = (
				<BoolSetting
					setting={setting}
					value={displayValue}
					editable={editable}
					notEditableExplanation={notEditableExplanation}
					onSave={onImmediateSave}
				/>
			);
			break;
		case "string-enum":
			content = (
				<EnumSetting
					setting={setting}
					value={displayValue}
					editable={editable}
					notEditableExplanation={notEditableExplanation}
					onSave={onImmediateSave}
				/>
			);
			break;
		default:
			content = (
				<TextSetting
					setting={setting}
					value={displayValue}
					editable={editable}
					notEditableExplanation={notEditableExplanation}
					errorMessage={errorMessage}
					isConfirming={isConfirming}
					onValueChange={onValueChange}
					onSave={onSave}
					onCancel={onCancel}
					onClearError={onClearError}
				/>
			);
	}

	if (pendingRestart) {
		return (
			<div className="border-l-2 border-[var(--color-illustrations-solid)] pl-3">
				{content}
			</div>
		);
	}

	return content;
}
