export type SettingType = "bool" | "string" | "int" | "string-enum";

export interface SettingSource {
	source: string;
	value: unknown;
	location?: string;
	reason?: string;
}

export interface SettingVariant {
	name: string;
	value: string;
	desc?: string;
}

export interface Setting {
	name: string;
	title: string;
	description: string;
	type: SettingType;
	value: unknown;
	category: string[];
	sources: SettingSource[];
	envs: string[];
	sensitive: boolean;
	editable: boolean;
	overridden: boolean;
	"required?": boolean;
	"pending-restart": boolean;
	"pending-value"?: unknown;
	unit?: string;
	variants?: (SettingVariant | string)[];
}

export interface BoxInfo {
	about: {
		version: string;
		timestamp: number;
	};
	license: {
		type: string;
		expiration: number;
	};
}

export interface CategoryDef {
	category: string[];
	desc: string;
	subcategories?: CategoryDef[];
}

export interface SettingsPageState {
	search: string;
	hideDefaults: boolean;
	editedSettings: Set<string>;
	pendingChanges: Record<string, unknown>;
	confirmations: Record<string, boolean>;
	errors: Record<string, string>;
}
