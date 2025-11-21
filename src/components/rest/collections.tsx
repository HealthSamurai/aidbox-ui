import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as ReactComponents from "@health-samurai/react-components";
import {
	type QueryClient,
	type QueryObserverResult,
	useQueryClient,
} from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";
import * as Utils from "../../utils";
import { parseHttpRequest } from "../../utils";
import * as ActiveTabs from "./active-tabs";
import { methodColors, type Tab } from "./active-tabs";

export type CollectionEntry = Resource & {
	type: string;
	command: string;
	title?: string;
	collection?: string;
};

export async function getCollectionsEntries(
	client: AidboxClientR5,
): Promise<CollectionEntry[]> {
	const response = await client.rawRequest({
		method: "GET",
		url: `/ui_snippet`,
	});
	const bundle: Bundle = await response.response.json();
	return (
		bundle.entry?.flatMap(({ resource }) => {
			if (resource) return resource as CollectionEntry;
			return [];
		}) ?? []
	);
}

async function SaveRequest(
	client: AidboxClientR5,
	tab: Tab,
	queryClient: QueryClient,
	collectionEntries: CollectionEntry[],
	setSelectedCollectionItemId: (id: string) => void,
	createNewCollection: boolean,
	setTabs: (tabs: Tab[]) => void,
	tabs: Tab[],
	collectionName?: string,
	saveToRootCollection?: boolean,
	setLeftMenuOpen?: (open: boolean) => void,
) {
	const currentSnippet = collectionEntries.find((entry) => entry.id === tab.id);
	let collection: string | undefined;
	let snippetId: string;

	if (!currentSnippet) {
		setLeftMenuOpen?.(true);
	}

	if (createNewCollection) {
		collection = getNewUniqueCollectionName(collectionEntries);
	} else if (saveToRootCollection && !currentSnippet) {
		collection = undefined;
	} else {
		collection =
			collectionName ||
			currentSnippet?.collection ||
			getNewUniqueCollectionName(collectionEntries);
	}

	if (currentSnippet && createNewCollection) {
		snippetId = crypto.randomUUID();
		setTabs([
			...tabs.map((t) => ({ ...t, selected: false })),
			{ ...tab, id: snippetId, selected: true },
		]);
	} else {
		snippetId = tab.id;
	}

	const result = await client.request({
		method: "PUT",
		url: `/ui_snippet/${snippetId}`,
		body: JSON.stringify({
			type: "http",
			command: Utils.generateHttpRequest(tab),
			...(collection ? { collection } : {}),
		}),
	});
	setSelectedCollectionItemId(snippetId);
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
	return result;
}

function getNewUniqueCollectionName(collectionEntries: CollectionEntry[]) {
	const collectionNames = collectionEntries
		.flatMap((entry) => entry.collection)
		.filter((name) => name !== undefined);

	const countNewNames = collectionNames.filter(
		(name) => name === "New Collection" || name.startsWith("New Collection ("),
	).length;

	if (countNewNames === 0) {
		return "New Collection";
	} else {
		return `New Collection (${countNewNames + 1})`;
	}
}

export const SaveButton = ({
	tab,
	collectionEntries,
	tabs,
	setSelectedCollectionItemId,
	setTabs,
	setLeftMenuOpen,
}: {
	tab: Tab;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
	setSelectedCollectionItemId: (id: string) => void;
	tabs: Tab[];
	setTabs: (tabs: Tab[]) => void;
	setLeftMenuOpen: (open: boolean) => void;
}) => {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	return (
		<ReactComponents.SplitButton>
			<ReactComponents.Button
				variant="secondary"
				onClick={() => {
					SaveRequest(
						client,
						tab,
						queryClient,
						collectionEntries.data ?? [],
						setSelectedCollectionItemId,
						false,
						setTabs,
						tabs,
						undefined,
						true,
						setLeftMenuOpen,
					);
					ReactComponents.toast("Request saved to collections");
				}}
			>
				<Lucide.Save />
				Save
			</ReactComponents.Button>
			<ReactComponents.DropdownMenu>
				<ReactComponents.DropdownMenuTrigger asChild>
					<ReactComponents.Button variant="secondary">
						<Lucide.ChevronDown />
					</ReactComponents.Button>
				</ReactComponents.DropdownMenuTrigger>
				<ReactComponents.DropdownMenuContent className="mr-4">
					<ReactComponents.DropdownMenuLabel>
						Save to collection:
					</ReactComponents.DropdownMenuLabel>
					<ReactComponents.DropdownMenuSeparator />
					{collectionEntries.data?.filter((entry) => entry.collection)
						?.length === 0 ? (
						<ReactComponents.DropdownMenuItem disabled>
							No collections
						</ReactComponents.DropdownMenuItem>
					) : (
						collectionEntries.data
							?.map((entry, idx, arr) => {
								const collectionName = entry.collection;
								if (
									collectionName !== undefined &&
									arr.findIndex((e) => e.collection === collectionName) === idx
								) {
									return collectionName;
								}
								return undefined;
							})
							.filter((collectionName) => collectionName !== undefined)
							.map((collectionName) => (
								<ReactComponents.DropdownMenuItem
									key={collectionName}
									onClick={() => {
										SaveRequest(
											client,
											tab,
											queryClient,
											collectionEntries.data ?? [],
											setSelectedCollectionItemId,
											false,
											setTabs,
											tabs,
											collectionName,
										);
									}}
								>
									{collectionName}
								</ReactComponents.DropdownMenuItem>
							))
					)}

					<ReactComponents.DropdownMenuSeparator />
					<ReactComponents.DropdownMenuItem asChild>
						<ReactComponents.Button
							variant="link"
							onClick={() => {
								SaveRequest(
									client,
									tab,
									queryClient,
									collectionEntries.data ?? [],
									setSelectedCollectionItemId,
									true,
									setTabs,
									tabs,
								);
								ReactComponents.toast("Request saved to collections");
							}}
						>
							<Lucide.Plus className="text-fg-link" />
							New collection
						</ReactComponents.Button>
					</ReactComponents.DropdownMenuItem>
				</ReactComponents.DropdownMenuContent>
			</ReactComponents.DropdownMenu>
		</ReactComponents.SplitButton>
	);
};

type ItemMeta = {
	method: string;
	path: string;
	headers: ActiveTabs.Header[];
	params?: ActiveTabs.Header[];
	body: string;
	title?: string;
	id: string;
};

function buildTreeView(
	entries: CollectionEntry[],
	pinnedCollections: string[],
): Record<string, ReactComponents.TreeViewItem<ItemMeta>> {
	const tree: Record<string, ReactComponents.TreeViewItem<ItemMeta>> = {
		root: {
			name: "root",
			children: [
				...[...pinnedCollections].reverse(),
				...entries
					.map((entry) => entry.collection)
					.filter((collection) => collection !== undefined)
					.filter((collection) => !pinnedCollections.includes(collection))
					.filter(
						(collection, idx, arr) =>
							arr.findIndex(
								(otherCollection) => otherCollection === collection,
							) === idx,
					),
			],
		},
	};

	entries.forEach((entry) => {
		const parsedCommand = parseHttpRequest(entry.command);
		if (!entry.id)
			throw new Error("missing id in collection entry", { cause: entry });

		tree[entry.id] = {
			name: entry.title ?? `${parsedCommand.method} ${parsedCommand.path}`,
			meta: {
				...parsedCommand,
				...(entry.title ? { title: entry.title } : {}),
				id: entry.id,
			},
		};
		if (entry.collection) {
			if (tree[entry.collection]) {
				tree[entry.collection]?.children?.push(entry.id);
			} else {
				tree[entry.collection] = {
					name: entry.collection,
					children: [entry.id],
				};
			}
		} else {
			tree.root?.children?.push(entry.id);
		}
	});

	return tree;
}

async function handleAddNewCollectionEntry(
	client: AidboxClientR5,
	collectionName: string,
	queryClient: QueryClient,
	setSelectedCollectionItemId: (id: string) => void,
	setTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void,
	tabs: Tab[],
) {
	const newTab = ActiveTabs.addTab(tabs, setTabs);
	await client.request({
		method: "PUT",
		url: `/ui_snippet/${newTab.id}`,
		body: JSON.stringify({
			type: "http",
			collection: collectionName,
			command: Utils.generateHttpRequest(newTab),
		}),
	});
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
	setSelectedCollectionItemId(newTab.id);
}

async function handleDeleteSnippet(
	client: AidboxClientR5,
	itemData: ReactComponents.TreeViewItem<ItemMeta>,
	queryClient: QueryClient,
	_tabs: Tab[],
	_setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
) {
	if (itemData?.meta?.id) {
		await client.request({
			method: "DELETE",
			url: `/ui_snippet/${itemData.meta.id}`,
		});
	}
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
	// ActiveTabs.removeTab(tabs, itemData.meta.id, setTabs);
}

async function handleDeleteCollection(
	client: AidboxClientR5,
	itemData: ReactComponents.TreeViewItem<ItemMeta>,
	queryClient: QueryClient,
) {
	await client.request({
		method: "DELETE",
		url: `/ui_snippet`,
		headers: {
			"x-conditional-delete": "remove-all",
		},
		params: [["id", itemData.children?.join(",") ?? ""]],
	});
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
}

function CollectionMoreButton({
	itemData,
	queryClient,
	tree,
	itemId,
}: {
	itemData: ReactComponents.TreeViewItem<ItemMeta>;
	queryClient: QueryClient;
	tree: ReactComponents.TreeInstance<ReactComponents.TreeViewItem<ItemMeta>>;
	itemId: string;
}) {
	const client = useAidboxClient();
	const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);

	return (
		<ReactComponents.DropdownMenu>
			<ReactComponents.DropdownMenuTrigger asChild>
				<ReactComponents.Button
					variant="link"
					size="small"
					className="p-0 h-4 opacity-0 data-[state=open]:opacity-100 group-hover/tree-item-label:opacity-100"
					asChild
				>
					<span>
						<Lucide.Ellipsis />
					</span>
				</ReactComponents.Button>
			</ReactComponents.DropdownMenuTrigger>
			<ReactComponents.DropdownMenuContent>
				<ReactComponents.DropdownMenuItem
					onClick={() => tree.getItemInstance(itemId).startRenaming()}
				>
					Rename
				</ReactComponents.DropdownMenuItem>
				<ReactComponents.DropdownMenuItem
					variant="destructive"
					onClick={() => setIsAlertDialogOpen(true)}
				>
					Delete
				</ReactComponents.DropdownMenuItem>
			</ReactComponents.DropdownMenuContent>

			<ReactComponents.AlertDialog
				open={isAlertDialogOpen}
				onOpenChange={setIsAlertDialogOpen}
			>
				<ReactComponents.AlertDialogContent>
					<ReactComponents.AlertDialogHeader>
						<ReactComponents.AlertDialogTitle>
							Delete snippet?
						</ReactComponents.AlertDialogTitle>
						<ReactComponents.AlertDialogDescription>
							Are you sure you want to delete this collection? This action
							cannot be undone.
						</ReactComponents.AlertDialogDescription>
					</ReactComponents.AlertDialogHeader>
					<ReactComponents.AlertDialogFooter>
						<ReactComponents.AlertDialogCancel
							onClick={() => setIsAlertDialogOpen(false)}
						>
							Cancel
						</ReactComponents.AlertDialogCancel>
						<ReactComponents.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								handleDeleteCollection(client, itemData, queryClient);
								setIsAlertDialogOpen(false);
							}}
							asChild
						>
							<span>
								<Lucide.Trash /> Delete
							</span>
						</ReactComponents.AlertDialogAction>
					</ReactComponents.AlertDialogFooter>
				</ReactComponents.AlertDialogContent>
			</ReactComponents.AlertDialog>
		</ReactComponents.DropdownMenu>
	);
}

function SnippetMoreButton({
	itemData,
	queryClient,
	tabs,
	setTabs,
	tree,
}: {
	itemData: ReactComponents.TreeViewItem<ItemMeta>;
	queryClient: QueryClient;
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	tree: ReactComponents.TreeInstance<ReactComponents.TreeViewItem<ItemMeta>>;
}) {
	const client = useAidboxClient();
	const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);

	return (
		<ReactComponents.DropdownMenu>
			<ReactComponents.DropdownMenuTrigger asChild>
				<ReactComponents.Button
					variant="link"
					size="small"
					className="p-0 h-4 opacity-0 data-[state=open]:opacity-100 group-hover/tree-item-label:opacity-100"
					asChild
				>
					<span>
						<Lucide.Ellipsis />
					</span>
				</ReactComponents.Button>
			</ReactComponents.DropdownMenuTrigger>
			<ReactComponents.DropdownMenuContent>
				<ReactComponents.DropdownMenuItem
					onClick={() => {
						if (itemData.meta?.id !== undefined) {
							tree.getItemInstance(itemData.meta.id).startRenaming();
						}
					}}
				>
					Rename
				</ReactComponents.DropdownMenuItem>
				<ReactComponents.DropdownMenuItem
					variant="destructive"
					onClick={() => setIsAlertDialogOpen(true)}
				>
					Delete
				</ReactComponents.DropdownMenuItem>
			</ReactComponents.DropdownMenuContent>

			<ReactComponents.AlertDialog
				open={isAlertDialogOpen}
				onOpenChange={setIsAlertDialogOpen}
			>
				<ReactComponents.AlertDialogContent>
					<ReactComponents.AlertDialogHeader>
						<ReactComponents.AlertDialogTitle>
							Delete snippet?
						</ReactComponents.AlertDialogTitle>
						<ReactComponents.AlertDialogDescription>
							Are you sure you want to delete this snippet? This action cannot
							be undone.
						</ReactComponents.AlertDialogDescription>
					</ReactComponents.AlertDialogHeader>
					<ReactComponents.AlertDialogFooter>
						<ReactComponents.AlertDialogCancel
							onClick={() => setIsAlertDialogOpen(false)}
						>
							Cancel
						</ReactComponents.AlertDialogCancel>
						<ReactComponents.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								handleDeleteSnippet(
									client,
									itemData,
									queryClient,
									tabs,
									setTabs,
								);
								setIsAlertDialogOpen(false);
							}}
							asChild
						>
							<span>
								<Lucide.Trash /> Delete
							</span>
						</ReactComponents.AlertDialogAction>
					</ReactComponents.AlertDialogFooter>
				</ReactComponents.AlertDialogContent>
			</ReactComponents.AlertDialog>
		</ReactComponents.DropdownMenu>
	);
}

function customItemView(
	client: AidboxClientR5,
	item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<ItemMeta>>,
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
	tabs: Tab[],
	queryClient: QueryClient,
	setSelectedCollectionItemId: (id: string) => void,
	tree: ReactComponents.TreeInstance<ReactComponents.TreeViewItem<ItemMeta>>,
	pinnedCollections: string[],
	setPinnedCollections: (ids: string[]) => void,
) {
	const isFolder = item.isFolder();
	const itemData = item.getItemData();
	const itemId = item.getId();
	const isPinned = pinnedCollections.includes(itemId);
	if (isFolder) {
		return (
			<div className="flex justify-between items-center w-full">
				{item.isRenaming() ? (
					<ReactComponents.Input
						className="h-5 border-none p-0"
						autoFocus
						{...item.getRenameInputProps()}
					/>
				) : (
					<React.Fragment>
						<div>{itemData?.name}</div>

						<div className="flex items-center gap-2">
							<ReactComponents.Button
								className="opacity-0 group-hover/tree-item-label:opacity-100 has-aria-expanded:opacity-100 p-0 h-4"
								variant="link"
								size="small"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									handleAddNewCollectionEntry(
										client,
										itemData?.name,
										queryClient,
										setSelectedCollectionItemId,
										setTabs,
										tabs,
									);
								}}
								asChild
							>
								<span>
									<Lucide.Plus />
								</span>
							</ReactComponents.Button>
							<ReactComponents.Button
								variant="link"
								size="small"
								className={`hover:text-fg-link ${!isPinned ? "opacity-0" : ""} group-hover/tree-item-label:opacity-100 has-aria-expanded:opacity-100 p-0 h-4`}
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									if (isPinned) {
										setPinnedCollections(
											pinnedCollections.filter((id) => id !== itemId),
										);
									} else {
										setPinnedCollections([...pinnedCollections, itemId]);
									}
								}}
								asChild
							>
								<span>
									{isPinned ? <ReactComponents.PinIcon /> : <Lucide.Pin />}
								</span>
							</ReactComponents.Button>
							<CollectionMoreButton
								itemData={itemData}
								queryClient={queryClient}
								tree={tree}
								itemId={item.getId()}
							/>
						</div>
					</React.Fragment>
				)}
			</div>
		);
	} else {
		const parsedCommand = itemData?.meta;
		const methodColor =
			methodColors[parsedCommand?.method as keyof typeof methodColors];
		return (
			<div className="flex justify-between items-center w-full">
				<div className="flex items-center gap-2">
					<div
						className={`${methodColor} opacity-50 group-hover/tree-item-label:opacity-100 in-data-[selected=true]:opacity-100 font-medium min-w-13 w-12 text-right`}
					>
						{parsedCommand?.method}
					</div>
					{item.isRenaming() ? (
						<ReactComponents.Input
							className="h-5 border-none p-0"
							autoFocus
							{...item.getRenameInputProps()}
						/>
					) : itemData?.meta?.title ? (
						<div>{itemData.meta.title}</div>
					) : (
						<div>{parsedCommand?.path || "New request"}</div>
					)}
				</div>
				<div className="flex items-center gap-2">
					<SnippetMoreButton
						itemData={itemData}
						queryClient={queryClient}
						tabs={tabs}
						setTabs={setTabs}
						tree={tree}
					/>
				</div>
			</div>
		);
	}
}

const NoCollectionsView = ({
	selectedTab,
	collectionEntries,
	setSelectedCollectionItemId,
	setTabs,
	tabs,
}: {
	selectedTab: Tab | undefined;
	collectionEntries: CollectionEntry[];
	setSelectedCollectionItemId: (id: string) => void;
	setTabs: (tabs: Tab[]) => void;
	tabs: Tab[];
}) => {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	if (selectedTab) {
		return (
			<div className="bg-bg-tertiary h-full flex items-center justify-center">
				<div className="flex flex-col items-center">
					<span className="text-text-disabled text-xl font-medium">
						No collections
					</span>
					<ReactComponents.Button
						variant="link"
						onClick={() =>
							SaveRequest(
								client,
								selectedTab,
								queryClient,
								collectionEntries,
								setSelectedCollectionItemId,
								true,
								setTabs,
								tabs,
								undefined,
								true,
							)
						}
					>
						<Lucide.Plus className="text-fg-link" />
						New collection
					</ReactComponents.Button>
				</div>
			</div>
		);
	}
};

async function handleRenameSnippet(
	client: AidboxClientR5,
	item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<ItemMeta>>,
	newTitle: string,
	queryClient: QueryClient,
) {
	if (item.isFolder()) {
		const snippetIds = item.getChildren().map((child) => child.getId());
		await client.request({
			method: "POST",
			url: `/`,
			body: JSON.stringify({
				resourceType: "Bundle",
				type: "transaction",
				entry: snippetIds.map((id) => ({
					request: {
						method: "PATCH",
						url: `/ui_snippet/${id}`,
					},
					resource: {
						resourceType: "ui_snippet",
						collection: newTitle,
					},
				})),
			}),
		});
	} else {
		await client.request({
			method: "PATCH",
			url: `/ui_snippet/${item.getItemData().meta?.id}`,
			body: JSON.stringify({
				title: newTitle,
			}),
		});
	}
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
}

export const CollectionsView = ({
	collectionEntries,
	setTabs,
	tabs,
	setSelectedCollectionItemId,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
	setSelectedCollectionItemId: (id: string) => void;
	selectedCollectionItemId: string | undefined;
}) => {
	const client = useAidboxClient();
	const [pinnedCollections, setPinnedCollections] = useLocalStorage<string[]>({
		key: "rest-console-pinned-collections",
		defaultValue: [],
	});
	const tree = buildTreeView(collectionEntries.data ?? [], pinnedCollections);
	const selectedTab = tabs.find((tab) => tab.selected);
	const queryClient = useQueryClient();

	if (collectionEntries.isPending) {
		return <div>Loading...</div>;
	}

	return (
		<React.Fragment>
			{collectionEntries.isSuccess && collectionEntries.data?.length === 0 ? (
				<NoCollectionsView
					selectedTab={selectedTab}
					collectionEntries={collectionEntries.data ?? []}
					setSelectedCollectionItemId={setSelectedCollectionItemId}
					setTabs={setTabs}
					tabs={tabs}
				/>
			) : (
				<div className="px-1 py-2">
					<ReactComponents.TreeView
						key={
							queryClient.getQueryState(["rest-console-collections"])
								?.dataUpdatedAt + pinnedCollections.join(",")
						}
						rootItemId="root"
						items={tree}
						onRename={(item, newTitle) => {
							handleRenameSnippet(client, item, newTitle, queryClient);
						}}
						customItemView={(data, tree) =>
							customItemView(
								client,
								data,
								setTabs,
								tabs,
								queryClient,
								setSelectedCollectionItemId,
								tree,
								pinnedCollections,
								setPinnedCollections,
							)
						}
					/>
				</div>
			)}
		</React.Fragment>
	);
};
