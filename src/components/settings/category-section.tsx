import { Separator } from "@health-samurai/react-components";
import { BoxInfoDisplay } from "./box-info";
import { SettingCard } from "./setting-card";
import type { BoxInfo, Setting } from "./types";
import { buildSectionId } from "./utils";

interface CategorySectionProps {
	category: string[];
	description?: string;
	settings: Setting[];
	isDebugMode: boolean;
	pendingChanges: Record<string, unknown>;
	confirmations: Record<string, boolean>;
	errors: Record<string, string>;
	onValueChange: (name: string, value: unknown) => void;
	onSave: (setting: Setting, value: unknown) => void;
	onCancel: (setting: Setting) => void;
	onClearError: (name: string) => void;
	onImmediateSave: (setting: Setting, value: unknown) => void;
	boxInfo?: BoxInfo;
}

export function CategorySection({
	category,
	description,
	settings,
	isDebugMode,
	pendingChanges,
	confirmations,
	errors,
	onValueChange,
	onSave,
	onCancel,
	onClearError,
	onImmediateSave,
	boxInfo,
}: CategorySectionProps) {
	const sectionId = buildSectionId(category);
	const isGeneral = category.length === 1 && category[0] === "General";
	const title = category.length > 1 ? category.join(": ") : category[0];

	return (
		<section id={sectionId} className="scroll-mt-4">
			<h2 className="mb-1 text-lg font-semibold text-text-primary">{title}</h2>
			{description && (
				<p className="mb-3 text-sm text-text-secondary">{description}</p>
			)}
			<Separator className="mb-4" />

			{isGeneral && <BoxInfoDisplay boxInfo={boxInfo} />}

			<div className="space-y-6">
				{settings.map((setting) => (
					<SettingCard
						key={setting.name}
						setting={setting}
						isDebugMode={isDebugMode}
						pendingValue={
							setting.name in pendingChanges
								? pendingChanges[setting.name]
								: undefined
						}
						isConfirming={confirmations[setting.name] ?? false}
						errorMessage={errors[setting.name]}
						onValueChange={onValueChange}
						onSave={onSave}
						onCancel={onCancel}
						onClearError={onClearError}
						onImmediateSave={onImmediateSave}
					/>
				))}
			</div>
		</section>
	);
}
