import * as ReactComponents from "@health-samurai/react-components";
import {
	type QueryClient,
	type QueryObserverResult,
	useQueryClient,
} from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as Auth from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import * as Utils from "../../utils";
import { parseHttpRequest } from "../../utils";
import * as ActiveTabs from "./active-tabs";
import { methodColors, type Tab } from "./active-tabs";

export interface CollectionEntry {
	id: string;
	type: string;
	command: string;
	title?: string;
	collection?: string;
}

export async function getCollectionsEntries(): Promise<CollectionEntry[]> {
	const response = await Auth.AidboxCallWithMeta({
		method: "GET",
		url: `/ui_snippet`,
	});
	return (
		JSON.parse(response.body).entry?.map((entry: any) => entry.resource) ?? []
	);
}

async function SaveRequest(
	tab: Tab,
	queryClient: QueryClient,
	collectionEntries: CollectionEntry[],
	setSelectedCollectionItemId: (id: string) => void,
	createNewCollection: boolean,
	setTabs: (tabs: Tab[]) => void,
	tabs: Tab[],
) {
	const currentSnippet = collectionEntries.find((entry) => entry.id === tab.id);
	let collection: string;
	let snippetId: string;

	if (createNewCollection) {
		collection = getNewUniqueCollectionName(collectionEntries);
	} else {
		collection =
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

	const result = await Auth.AidboxCallWithMeta({
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
}: {
	tab: Tab;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
	setSelectedCollectionItemId: (id: string) => void;
	tabs: Tab[];
	setTabs: (tabs: Tab[]) => void;
}) => {
	const queryClient = useQueryClient();
	return (
		<ReactComponents.SplitButton>
			<ReactComponents.Button
				variant="secondary"
				onClick={() => {
					SaveRequest(
						tab,
						queryClient,
						collectionEntries.data ?? [],
						setSelectedCollectionItemId,
						false,
						setTabs,
						tabs,
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
					<ReactComponents.DropdownMenuItem disabled>
						No collections
					</ReactComponents.DropdownMenuItem>
					<ReactComponents.DropdownMenuSeparator />
					<ReactComponents.DropdownMenuItem asChild>
						<ReactComponents.Button
							variant="link"
							onClick={() => {
								SaveRequest(
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

function buildTreeView(
	entries: CollectionEntry[],
): Record<string, ReactComponents.TreeViewItem<any>> {
	const tree: Record<string, ReactComponents.TreeViewItem<any>> = {
		root: {
			name: "root",
			children: entries
				.filter(
					(entry, idx, arr) =>
						entry.collection &&
						arr.findIndex((e) => e.collection === entry.collection) === idx,
				)
				.map((entry) => entry.collection!),
		},
	};

	entries.forEach((entry) => {
		const parsedCommand = parseHttpRequest(entry.command);
		tree[entry.id] = {
			name: entry.title ?? `${parsedCommand.method} ${parsedCommand.path}`,
			meta: {
				...parsedCommand,
				title: entry.title,
				id: entry.id,
			},
		};
		if (entry.collection) {
			if (tree[entry.collection]) {
				tree[entry.collection]!.children!.push(entry.id);
			} else {
				tree[entry.collection] = {
					name: entry.collection,
					children: [entry.id],
				};
			}
		} else {
			tree.root!.children!.push(entry.id);
		}
	});

	return tree;
}

async function handleAddNewCollectionEntry(
	collectionName: string,
	queryClient: QueryClient,
	setSelectedCollectionItemId: (id: string) => void,
	setTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void,
	tabs: Tab[],
) {
	const newTab = ActiveTabs.addTab(tabs, setTabs);
	await Auth.AidboxCallWithMeta({
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
	itemData: ReactComponents.TreeViewItem<any>,
	queryClient: QueryClient,
	tabs: Tab[],
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
) {
	const result = await Auth.AidboxCallWithMeta({
		method: "DELETE",
		url: `/ui_snippet/${itemData.meta.id}`,
	});
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
	ActiveTabs.removeTab(tabs, itemData.meta.id, setTabs);
}

function SnippetMoreButton({
	itemData,
	queryClient,
	tabs,
	setTabs,
	tree,
}: {
	itemData: ReactComponents.TreeViewItem<any>;
	queryClient: QueryClient;
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	tree: ReactComponents.TreeInstance<ReactComponents.TreeViewItem<any>>;
}) {
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
					onClick={() => tree.getItemInstance(itemData.meta.id).startRenaming()}
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
								handleDeleteSnippet(itemData, queryClient, tabs, setTabs);
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
	item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<any>>,
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void,
	tabs: Tab[],
	queryClient: QueryClient,
	setSelectedCollectionItemId: (id: string) => void,
	tree: ReactComponents.TreeInstance<ReactComponents.TreeViewItem<any>>,
) {
	const isFolder = item.isFolder();
	const itemData = item.getItemData();
	if (isFolder) {
		return (
			<div className="flex justify-between items-center w-full">
				<div>{itemData?.name}</div>
				<div className="hidden group-hover/tree-item-label:flex items-center gap-2">
					<ReactComponents.Button
						variant="link"
						size="small"
						className="p-0 h-4"
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							handleAddNewCollectionEntry(
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
						className="p-0 h-4 hover:text-fg-link"
						asChild
					>
						<span>
							<Lucide.Pin />
						</span>
					</ReactComponents.Button>
				</div>
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
					) : itemData.meta.title ? (
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
								selectedTab,
								queryClient,
								collectionEntries,
								setSelectedCollectionItemId,
								true,
								setTabs,
								tabs,
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
	item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<any>>,
	newTitle: string,
	queryClient: QueryClient,
) {
	await Auth.AidboxCallWithMeta({
		method: "PATCH",
		url: `/ui_snippet/${item.getItemData().meta?.id}`,
		body: JSON.stringify({
			title: newTitle,
		}),
	});
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
}

export const CollectionsView = ({
	collectionEntries,
	setTabs,
	tabs,
	setSelectedCollectionItemId,
	selectedCollectionItemId,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
	setSelectedCollectionItemId: (id: string) => void;
	selectedCollectionItemId: string | undefined;
}) => {
	const tree = buildTreeView(collectionEntries.data ?? []);
	const selectedTab = tabs.find((tab) => tab.selected);
	const queryClient = useQueryClient();

	const selectedTabEntry = collectionEntries.data?.find(
		(entry) => entry.id === selectedCollectionItemId,
	);

	const [expandedItemIds, setExpandedItemIds] = useLocalStorage<string[]>({
		key: "rest-console-expanded-items",
		defaultValue: ["root", selectedTabEntry?.collection ?? ""],
	});

	function handleSelectItem(
		item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<any>>,
		expandedItemIds: string[],
		setExpandedItemIds: (ids: string[]) => void,
	) {
		if (item.isFolder()) {
			if (item.isExpanded()) {
				setExpandedItemIds(expandedItemIds.filter((id) => id !== item.getId()));
			} else {
				setExpandedItemIds(expandedItemIds.concat(item.getId()));
			}
			return;
		}
		const activeTab = tabs.find(
			(tab) => tab.id === item.getItemData().meta?.id,
		);

		if (activeTab) {
			setTabs(
				tabs.map((tab) => ({ ...tab, selected: tab.id === activeTab.id })),
			);
		} else {
			setTabs(
				tabs
					.map((tab) => ({ ...tab, selected: false }))
					.concat({
						id: item.getItemData().meta?.id,
						method: item.getItemData().meta?.method,
						path: item.getItemData().meta?.path,
						body: item.getItemData().meta?.body,
						headers: item.getItemData().meta?.headers || [
							{ id: "0", name: "", value: "", enabled: true },
						],
						params: item.getItemData().meta?.params || [
							{ id: "0", name: "", value: "", enabled: true },
						],
						selected: true,
					}),
			);
		}
	}

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
						key={collectionEntries.data?.length}
						rootItemId="root"
						items={tree}
						selectedItemId={selectedCollectionItemId ?? "root"}
						expandedItemIds={expandedItemIds}
						onRename={(item, newTitle) => {
							handleRenameSnippet(item, newTitle, queryClient);
						}}
						customItemView={(data, tree) =>
							customItemView(
								data,
								setTabs,
								tabs,
								queryClient,
								setSelectedCollectionItemId,
								tree,
							)
						}
						onSelectItem={(e) =>
							handleSelectItem(e, expandedItemIds, setExpandedItemIds)
						}
					/>
				</div>
			)}
		</React.Fragment>
	);
};
