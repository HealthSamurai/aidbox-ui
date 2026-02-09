import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";

type ResourceRow = {
	resourceType: string;
	tableSize: number;
	historySize: number;
	indexSize: number;
	defaultProfile: string;
	system: boolean;
	fhir: boolean;
	custom: boolean;
	populated: boolean;
};

function FavoriteCell({
	resourceType,
	isFavorite,
	onToggle,
}: {
	resourceType: string;
	isFavorite: boolean;
	onToggle: (resourceType: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onToggle(resourceType)}
			className="cursor-pointer transition-opacity pin-button"
			style={{ opacity: isFavorite ? 1 : 0 }}
		>
			<HSComp.PinIcon />
		</button>
	);
}

function ResourceList({
	tableData,
	filterQuery,
	favorites,
	onToggleFavorite,
}: {
	tableData: ResourceRow[];
	filterQuery: string;
	favorites: Set<string>;
	onToggleFavorite: (resourceType: string) => void;
}) {
	const navigate = useNavigate();

	const filteredData = useMemo(() => {
		if (!filterQuery) return tableData;
		const lowerQuery = filterQuery.toLowerCase();
		return tableData.filter((row) =>
			row.resourceType.toLowerCase().includes(lowerQuery),
		);
	}, [tableData, filterQuery]);

	const goToResource = (resourceType: string) =>
		navigate({
			to: "/resource/$resourceType",
			params: { resourceType },
		});

	return (
		<HSComp.Table zebra stickyHeader>
			<HSComp.TableHeader>
				<HSComp.TableRow>
					<HSComp.TableHead className="w-8">
						<HSComp.PinIcon />
					</HSComp.TableHead>
					<HSComp.TableHead className="w-52">Resource type</HSComp.TableHead>
					<HSComp.TableHead>Default profile</HSComp.TableHead>
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{filteredData.length ? (
					filteredData.map((row, index) => (
						<HSComp.TableRow key={row.resourceType} zebra index={index}>
							<HSComp.TableCell className="w-8">
								<FavoriteCell
									resourceType={row.resourceType}
									isFavorite={favorites.has(row.resourceType)}
									onToggle={onToggleFavorite}
								/>
							</HSComp.TableCell>
							<HSComp.TableCell
								type="link"
								className="w-52"
								onClick={() => goToResource(row.resourceType)}
							>
								{row.resourceType}
							</HSComp.TableCell>
							<HSComp.TableCell
								onClick={() => goToResource(row.resourceType)}
								className="cursor-pointer"
							>
								{row.defaultProfile}
							</HSComp.TableCell>
						</HSComp.TableRow>
					))
				) : (
					<HSComp.TableRow>
						<HSComp.TableCell colSpan={3} className="h-24 text-center">
							No results.
						</HSComp.TableCell>
					</HSComp.TableRow>
				)}
			</HSComp.TableBody>
		</HSComp.Table>
	);
}

type ResourceTypeInfo = {
	"system?": boolean;
	"fhir?": boolean;
	"custom?": boolean;
	"default-profile": string;
};

type ResourceDataStats = {
	total_size?: number;
	index_size?: number;
	num_rows?: number;
};

type ResourceData = {
	resources: Record<string, ResourceTypeInfo>;
	stats: Record<string, ResourceDataStats>;
};

function useResourceData(client: AidboxClientR5) {
	return useQuery<ResourceData>({
		queryKey: ["resource-browser-resources"],
		queryFn: async () => {
			const [resourceTypes, stats] = await Promise.all([
				client.rawRequest({
					method: "GET",
					url: "/$resource-types",
				}),
				client.rawRequest({
					method: "GET",
					url: "/$resource-types-pg-stats",
				}),
			]);
			return {
				resources: await resourceTypes.response.json(),
				stats: await stats.response.json(),
			};
		},
	});
}

function profileName(url: string): string {
	if (!url) return "";
	const lastSlash = url.lastIndexOf("/");
	return lastSlash >= 0 ? url.slice(lastSlash + 1) : url;
}

function useProcessedData(
	data: ResourceData | undefined,
	favorites: Set<string>,
): ResourceRow[] {
	return useMemo(() => {
		if (!data) return [];
		const { resources, stats } = data;

		const rows = Object.entries(resources || {}).map(([key, value]) => {
			const keyLower = key.toLowerCase();
			const resourceStats = stats[keyLower] || {};
			const historyStats = stats[`${keyLower}_history`] || {};

			return {
				resourceType: key,
				tableSize: resourceStats.total_size || 0,
				historySize: historyStats.total_size || 0,
				indexSize: resourceStats.index_size || 0,
				defaultProfile: profileName(value["default-profile"]),
				system: value["system?"],
				fhir: value["fhir?"],
				custom: value["custom?"],
				populated: (resourceStats.num_rows ?? 0) > 0,
			};
		});

		return rows.sort((a, b) => {
			const aFav = favorites.has(a.resourceType);
			const bFav = favorites.has(b.resourceType);
			if (aFav !== bFav) return aFav ? -1 : 1;
			return a.resourceType.localeCompare(b.resourceType);
		});
	}, [data, favorites]);
}

export function Browser() {
	const client = useAidboxClient();

	const [filterQuery, setFilterQuery] = useState("");
	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});

	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

	const { data, isLoading } = useResourceData(client);
	const allTableData = useProcessedData(data, favorites);

	const toggleFavorite = useMemo(
		() => (resourceType: string) => {
			setFavoritesArray((prev) => {
				if (prev.includes(resourceType)) {
					return prev.filter((item) => item !== resourceType);
				}
				return [...prev, resourceType];
			});
		},
		[setFavoritesArray],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Fetching resource types...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="overflow-hidden h-full flex flex-col">
			<div className="flex gap-3 items-center px-4 py-2 border-b border-border-primary">
				<HSComp.Input
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search resources"
					value={filterQuery}
					onChange={(e) => setFilterQuery(e.target.value)}
				/>
				<HSComp.Button variant="primary">Search</HSComp.Button>
				<div className="w-px h-6 bg-border-primary" />
				<HSComp.Button variant="secondary">+ Create</HSComp.Button>
			</div>
			<div className="grow min-h-0">
				<ResourceList
					tableData={allTableData}
					filterQuery={filterQuery}
					favorites={favorites}
					onToggleFavorite={toggleFavorite}
				/>
			</div>
		</div>
	);
}
