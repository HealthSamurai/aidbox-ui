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
		<section
			id={sectionId}
			className="flex flex-col scroll-mt-4 @[900px]:flex-row"
		>
			{/* Left pane — section heading */}
			<div className="sticky top-0 z-10 h-fit w-full shrink-0 bg-bg-primary pt-2 px-8 shadow-[0_10px_10px_0_rgb(255,255,255)] @[900px]:w-[346px] @[900px]:min-w-[346px] @[900px]:pl-16 @[900px]:pr-4">
				<h2 className="text-lg font-semibold text-text-primary">{title}</h2>
				{description && (
					<p className="mt-1 text-sm text-text-secondary">{description}</p>
				)}
			</div>

			{/* Right pane — form fields */}
			<div className="min-w-0 max-w-[644px] flex-1 px-8 pt-2 @[900px]:px-4">
				{isGeneral && (
					<div className="mb-6">
						<BoxInfoDisplay boxInfo={boxInfo} />
					</div>
				)}
				<div className="space-y-8">
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
			</div>
		</section>
	);
}
