export interface ResourceBrowserActions {
	listResourceTypes: (
		filter?: string,
	) => { resourceType: string; url: string; isFavorite: boolean }[];
	getFavorites: () => string[];
	toggleFavorite: (resourceType: string) => void;
	navigateToResourceType: (resourceType: string) => void;
}
