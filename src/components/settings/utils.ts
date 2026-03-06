import { createFuzzySearch } from "../../utils/fuzzy-search";
import {
	CATEGORIES,
	SENSITIVE_PLACEHOLDER,
	SOURCE_TITLES,
	USER_SOURCES,
} from "./constants";
import type { CategoryDef, Setting } from "./types";

export function getSettingValue(setting: Setting): unknown {
	if (setting.sources.length > 0 && setting.sensitive) {
		return SENSITIVE_PLACEHOLDER;
	}
	if (setting["pending-restart"]) {
		return setting["pending-value"];
	}
	return setting.value;
}

export function isSetByUser(setting: Setting): boolean {
	return setting.sources.some((s) => USER_SOURCES.has(s.source));
}

export function isPendingRestart(setting: Setting): boolean {
	return setting["pending-restart"] === true;
}

export function buildSectionId(category: string[]): string {
	return `${category
		.map((c) => c.toLowerCase())
		.join("-")
		.replace(/ /g, "-")}-settings`;
}

export function categoryKey(category: string[]): string {
	return category.join(" ");
}

export function categoryKeyFromSetting(setting: Setting): string {
	return categoryKey(setting.category);
}

export function groupByCategory(
	settings: Setting[],
): Record<string, Setting[]> {
	const groups: Record<string, Setting[]> = {};
	for (const setting of settings) {
		const key = categoryKeyFromSetting(setting);
		if (!groups[key]) groups[key] = [];
		groups[key].push(setting);
	}
	return groups;
}

export function getSettingSourceValue(
	setting: Setting,
	sourceTitle: string,
): unknown {
	const source = setting.sources.find((s) => s.source === sourceTitle);
	return source?.value;
}

export function getDefaultValue(setting: Setting): unknown {
	return getSettingSourceValue(setting, SOURCE_TITLES.default);
}

export function getEnvName(setting: Setting): string | undefined {
	const envSource = setting.sources.find((s) => s.source === SOURCE_TITLES.env);
	return envSource?.location ?? setting.envs?.[0];
}

export function getActiveSourceTitle(setting: Setting): string | undefined {
	const nonDefaultSource = setting.sources.find(
		(s) => s.source !== SOURCE_TITLES.default,
	);
	return nonDefaultSource?.source ?? SOURCE_TITLES.default;
}

export function isValueFromEnv(setting: Setting): boolean {
	return setting.sources.some(
		(s) => s.source === SOURCE_TITLES.env && s.value != null,
	);
}

export function isValueFromAidboxSetting(setting: Setting): boolean {
	const activeSource = getActiveSourceTitle(setting);
	return (
		activeSource === SOURCE_TITLES.database ||
		activeSource === SOURCE_TITLES.default ||
		activeSource === SOURCE_TITLES.maintenanceDb ||
		activeSource === SOURCE_TITLES.devPreset
	);
}

export function createSettingsSearch(settings: Setting[]) {
	return createFuzzySearch(settings, {
		threshold: 0.2,
		keys: [
			{ name: "name", weight: 4 },
			{ name: "envs", weight: 3 },
			{ name: "title", weight: 2 },
			{ name: "description", weight: 1 },
		],
	});
}

export function filterSettings(
	settings: Setting[],
	search: string,
	searchFn?: (query: string) => Setting[],
): Setting[] {
	let filtered = settings.filter((s) => s.category[0] !== "Zen Project");

	if (search.trim() && searchFn) {
		filtered = searchFn(search);
	}

	return filtered;
}

export function getNotEditableExplanation(
	setting: Setting,
	isDebugMode: boolean,
): string | undefined {
	if (!isDebugMode) return undefined;
	if (isValueFromEnv(setting)) return "Defined by environment variable";
	if (setting.overridden) return "System-defined value";
	if (!setting.editable) return "Not editable";
	return undefined;
}

export function isSettingEditable(
	setting: Setting,
	isDebugMode: boolean,
): boolean {
	return isDebugMode && setting.editable && !setting.overridden;
}

export function getAllCategoryKeys(): string[] {
	const keys: string[] = [];
	function walk(defs: CategoryDef[]) {
		for (const def of defs) {
			keys.push(categoryKey(def.category));
			if (def.subcategories) walk(def.subcategories);
		}
	}
	walk(CATEGORIES);
	return keys;
}

export function sortSettingsByCategory(
	grouped: Record<string, Setting[]>,
): [string, Setting[]][] {
	const order = getAllCategoryKeys();
	const orderMap = new Map(order.map((k, i) => [k, i]));
	return Object.entries(grouped).sort(
		([a], [b]) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999),
	);
}

export function overrideSettingValue(
	setting: Setting,
	value: unknown,
): unknown {
	if (setting.name === "box-id" && value === "devbox") return "Aidbox";
	return value;
}

export function removeNonDigits(value: string): string {
	return value.replace(/\D/g, "");
}
