export interface PackageDetailActions {
	getActiveTab: () => string;
	setActiveTab: (tab: string) => void;
	getPackageInfo: (format?: "visual" | "json") => unknown;
	setPackageInfoView: (view: string) => void;
	searchCanonicals: (
		query?: string,
		page?: number,
	) => Promise<{
		total: number;
		page: number;
		totalPages: number;
		entries: { resourceType: string; url: string; id: string }[];
	}>;
	selectCanonical: (id: string) => void;
	reinstallPackage: () => void;
	deletePackage: () => void;
}
