import { Tabs, TabsList, TabsTrigger } from "@health-samurai/react-components";
import type { ReactNode } from "react";

export function ResourceEditorToolbar({
	label,
	mode,
	onModeChange,
	disabled,
	tabs = [
		{ value: "form", label: "Form" },
		{ value: "code", label: "Code" },
	],
	actions,
}: {
	label: string;
	mode: string;
	onModeChange: (mode: string) => void;
	disabled: boolean;
	tabs?: { value: string; label: string; testId?: string }[];
	actions?: ReactNode;
}) {
	return (
		<div className="flex shrink-0 items-center justify-between gap-4 border-b px-4">
			<Tabs value={mode} onValueChange={onModeChange}>
				<TabsList aria-label={`${label} editor mode`}>
					{tabs.map(({ value, label, testId }) => (
						<TabsTrigger
							key={value}
							value={value}
							disabled={disabled}
							data-test-id={testId}
						>
							{label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}
