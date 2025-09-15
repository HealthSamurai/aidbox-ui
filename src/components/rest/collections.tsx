import * as ReactComponents from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import {
	type QueryClient,
	type QueryObserverResult,
	useQueryClient,
} from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as Auth from "../../api/auth";
import * as Utils from "../../utils";
import { parseHttpRequest } from "../../utils";
import { methodColors, type Tab } from "./active-tabs";

export interface CollectionEntry {
	id: string;
	type: string;
	command: string;
	title?: string;
	collection?: string[];
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
	collection: string[],
) {
	const result = await Auth.AidboxCallWithMeta({
		method: "PUT",
		url: `/ui_snippet/${tab.id}`,
		body: JSON.stringify({
			type: "http",
			command: Utils.generateHttpRequest(tab),
			...(collection.length > 0 ? { collection } : {}),
		}),
	});
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
}: {
	tab: Tab;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
}) => {
	const queryClient = useQueryClient();
	return (
		<ReactComponents.SplitButton>
			<ReactComponents.Button
				variant="secondary"
				onClick={() => {
					SaveRequest(tab, queryClient, [
						getNewUniqueCollectionName(collectionEntries.data ?? []),
					]);
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
								SaveRequest(tab, queryClient, [
									getNewUniqueCollectionName(collectionEntries.data ?? []),
								]);
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
// [a b c]
// [a b]

// a -> b
// b -> c
// b -> uuid
// c -> uuid

function addCollectionToTree(
	tree: Record<string, ReactComponents.TreeViewItem<any>>,
	entryId: string,
	collection: string[],
) {
	if (collection.length === 0) {
		return;
	}
	const uniqeCollectionId = collection.join("-");
	if (tree[uniqeCollectionId]) {
		tree[uniqeCollectionId].children!.push(entryId);
	} else {
		tree[uniqeCollectionId] = {
			name: collection.at(-1)!,
			children: [entryId],
		};
		const parentCollection = collection.slice(0, -1);
		const parentCollectionId = parentCollection.join("-");
		addCollectionToTree(tree, parentCollectionId, parentCollection);
	}
}

function buildTreeView(
	entries: CollectionEntry[],
): Record<string, ReactComponents.TreeViewItem<any>> {
	const tree: Record<string, ReactComponents.TreeViewItem<any>> = {
		root: {
			name: "root",
			children: entries
				.filter((entry) => entry.collection && entry.collection.length > 0)
				.map((entry) => entry.collection!.at(0) ?? ""),
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
			addCollectionToTree(tree, entry.id, entry.collection);
		} else {
			tree.root!.children!.push(entry.id);
		}
	});

	return tree;
}

function customItemView(
	item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<any>>,
) {
	const isFolder = item.isFolder();
	const itemData = item.getItemData();

	if (isFolder) {
		return <div>{itemData?.name}</div>;
	} else {
		const parsedCommand = itemData?.meta;
		const methodColor =
			methodColors[parsedCommand?.method as keyof typeof methodColors];
		return (
			<div className="flex items-center gap-2">
				<div
					className={`${methodColor} opacity-50 group-hover/tree-item-label:opacity-100 in-data-[selected=true]:opacity-100 font-medium min-w-13 w-13 text-left`}
				>
					{parsedCommand?.method}
				</div>
				{itemData.meta.title ? (
					<div>{itemData.meta.title}</div>
				) : (
					<div>{parsedCommand?.path}</div>
				)}
			</div>
		);
	}
}

const NoCollectionsView = ({
	selectedTab,
	collectionEntries,
}: {
	selectedTab: Tab | undefined;
	collectionEntries: CollectionEntry[];
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
							SaveRequest(selectedTab, queryClient, [
								getNewUniqueCollectionName(collectionEntries),
							])
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

export const CollectionsView = ({
	collectionEntries,
	setTabs,
	tabs,
}: {
	tabs: Tab[];
	setTabs: (tabs: Tab[]) => void;
	collectionEntries: QueryObserverResult<CollectionEntry[]>;
}) => {
	const tree = buildTreeView(collectionEntries.data ?? []);
	const selectedTab = tabs.find((tab) => tab.selected);
	const selectedTabId = selectedTab?.id;

	function handleSelectItem(
		item: ReactComponents.ItemInstance<ReactComponents.TreeViewItem<any>>,
	) {
		if (item.isFolder()) {
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

	const selectedTabEntry = collectionEntries.data?.find(
		(entry) => entry.id === selectedTabId,
	);

	const expandedItemIds = ["root"].concat(selectedTabEntry?.collection ?? []);

	if (collectionEntries.isPending) {
		return <div>Loading...</div>;
	}

	console.log(tree);

	return (
		<React.Fragment>
			{collectionEntries.isSuccess && collectionEntries.data?.length === 0 ? (
				<NoCollectionsView
					selectedTab={selectedTab}
					collectionEntries={collectionEntries.data ?? []}
				/>
			) : (
				<div className="px-1 py-2">
					<ReactComponents.TreeView
						key={collectionEntries.data?.length}
						rootItemId="root"
						items={tree}
						selectedItemId={selectedTabId ?? "root"}
						expandedItemIds={expandedItemIds}
						customItemView={customItemView}
						onSelectItem={handleSelectItem}
					/>
				</div>
			)}
		</React.Fragment>
	);
};
