import { Input, ScrollArea } from "@health-samurai/react-components";
import { Search } from "lucide-react";
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
	onSearchChange: (value: string) => void;
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
	searchFn?: (query: string) => Setting[];
}

export function SettingsContent({
	allSettings,
	search,
	onSearchChange,
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
	searchFn,
}: SettingsContentProps) {
	const filtered = filterSettings(allSettings, search, searchFn);
	const grouped = groupByCategory(filtered);
	const sorted = sortSettingsByCategory(grouped);

	return (
		<div className="relative flex h-full flex-col">
			<div className="bg-bg-primary px-16 py-4">
				<div className="mx-auto w-1/2">
					<Input
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search Settings"
						leftSlot={<Search size={16} />}
						className="rounded-full"
					/>
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				<div className="@container mx-auto max-w-[990px] pb-20 pt-2">
					<DeprecatedCapabilitiesAlert capabilities={deprecatedCapabilities} />

					{sorted.length === 0 ? (
						<p className="py-8 text-center text-text-secondary">
							No settings found
						</p>
					) : (
						<div className="mt-6 space-y-10">
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

			<div className="absolute bottom-0 right-0 z-20 p-4">
				<RestartRequiredAlert settings={allSettings} />
			</div>
		</div>
	);
}
