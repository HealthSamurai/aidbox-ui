export type SidebarMode = "expanded" | "collapsed";

// UI History types based on Aidbox response
export interface UIHistoryResource {
	id: string;
	command: string;
	meta: {
		createdAt: string;
	};
}

export interface UIHistoryEntry {
	resource: UIHistoryResource;
}

export interface UIHistoryResponse {
	resourceType: "Bundle";
	type: "searchset";
	total: number;
	entry: UIHistoryEntry[];
}
