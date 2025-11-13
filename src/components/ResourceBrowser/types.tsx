import type { Snapshot } from "@aidbox-ui/humanize";
import type { AidboxClient } from "@health-samurai/aidbox-client";

export interface ResourcesPageProps {
	client: AidboxClient;
	resourceType: string;
}

export type Resource = {
	id?: string;
	meta?: {
		lastUpdated: string;
	};
};

export interface ResourcesTabTableProps {
	data:
		| {
				resources: Resource[];
				resourceKeys: string[];
				snapshot?: Snapshot;
		  }
		| undefined;
}

export interface ResourcesTabHeaderProps {
	handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ResourcesPageContext {
	resourceType: string;
}

export interface ResourcesTabContentContext {
	resourcesLoading: boolean;
}
