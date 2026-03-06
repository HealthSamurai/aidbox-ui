export interface CanonicalResourceActions {
	getResourceInfo: () => {
		name: string;
		url: string;
		version: string;
		resourceType: string;
		packageId: string;
	};
	getActiveView: () => string;
	setActiveView: (view: string) => void;
	getResourceJson: () => Record<string, unknown> | null;
	getStructureElements: (
		type: "differential" | "snapshot",
	) => Promise<unknown[]>;
	getValueSetExpansion: () => Promise<
		{ system?: string; code?: string; display?: string }[]
	>;
	searchValueSetExpansion: (filter: string) => Promise<{
		filter: string;
		total: number;
		concepts: { system?: string; code?: string; display?: string }[];
	}>;
	openInEditor: () => void;
}
