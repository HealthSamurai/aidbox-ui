import { ScrollArea } from "@health-samurai/react-components";
import { DeprecatedCapabilitiesAlert, RestartRequiredAlert } from "./alerts";
import { CategorySection } from "./category-section";
import { CATEGORIES } from "./constants";
import type {
	BoxInfo,
	CategoryDef,
	DeprecatedCapabilities,
	Setting,
} from "./types";
import {
	categoryKey,
	filterSettings,
	groupByCategory,
	sortSettingsByCategory,
} from "./utils";

function getCategoryDescription(category: string[]): string | undefined {
	const key = categoryKey(category);
	function find(defs: CategoryDef[]): string | undefined {
		for (const def of defs) {
			if (categoryKey(def.category) === key) return def.desc;
			if (def.subcategories) {
				const found = find(def.subcategories);
				if (found) return found;
			}
		}
		return undefined;
	}
	return find(CATEGORIES);
}

interface SettingsContentProps {
	allSettings: Setting[];
	search: string;
	hideDefaults: boolean;
	editedSettings: Set<string>;
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
	deprecatedCapabilities?: DeprecatedCapabilities;
}

export function SettingsContent({
	allSettings,
	search,
	hideDefaults,
	editedSettings,
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
	deprecatedCapabilities,
}: SettingsContentProps) {
	const filtered = filterSettings(
		allSettings,
		search,
		hideDefaults,
		editedSettings,
	);
	const grouped = groupByCategory(filtered);
	const sorted = sortSettingsByCategory(grouped);

	return (
		<ScrollArea className="h-full flex-1">
			<div className="max-w-3xl p-6">
				<RestartRequiredAlert settings={allSettings} />
				<DeprecatedCapabilitiesAlert capabilities={deprecatedCapabilities} />

				{sorted.length === 0 ? (
					<p className="py-8 text-center text-text-secondary">
						No settings found
					</p>
				) : (
					<div className="space-y-10">
						{sorted.map(([catKey, settings]) => {
							const category = settings[0].category;
							return (
								<CategorySection
									key={catKey}
									category={category}
									description={getCategoryDescription(category)}
									settings={settings}
									isDebugMode={isDebugMode}
									pendingChanges={pendingChanges}
									confirmations={confirmations}
									errors={errors}
									onValueChange={onValueChange}
									onSave={onSave}
									onCancel={onCancel}
									onClearError={onClearError}
									onImmediateSave={onImmediateSave}
									boxInfo={boxInfo}
								/>
							);
						})}
					</div>
				)}
			</div>
		</ScrollArea>
	);
}
