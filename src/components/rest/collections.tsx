import * as ReactComponents from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import * as Auth from "../../api/auth";
import * as Utils from "../../utils";
import { parseHttpRequest } from "../../utils";
import { methodColors, type Tab } from "./active-tabs";

type SaveCollectionButtonMode = "empty-collection" | "filled-collection";

interface CollectionEntry {
	id: string;
	type: string;
	command: string;
	title?: string;
	collection?: string[];
}

async function getCollectionsEntries(): Promise<CollectionEntry[]> {
	const response = await Auth.AidboxCallWithMeta({
		method: "GET",
		url: `/ui_snippet`,
	});
	return (
		JSON.parse(response.body).entry?.map((entry: any) => entry.resource) ?? []
	);
}

async function SaveRequest(tab: Tab, queryClient: QueryClient) {
	const result = await Auth.AidboxCallWithMeta({
		method: "PUT",
		url: `/ui_snippet/${tab.id}`,
		body: JSON.stringify({
			type: "http",
			command: Utils.generateHttpRequest(tab),
		}),
	});
	queryClient.invalidateQueries({ queryKey: ["rest-console-collections"] });
	return result;
}

export const SaveButton = ({ tab }: { tab: Tab }) => {
	const queryClient = useQueryClient();
	return (
		<ReactComponents.SplitButton>
			<ReactComponents.Button
				variant="secondary"
				onClick={() => {
					SaveRequest(tab, queryClient);
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
					<ReactComponents.DropdownMenuItem>
						<Lucide.Plus className="text-fg-link" />
						New collection
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
			children: [],
		},
	};

	entries.forEach((entry) => {
		if (entry.collection) {
			entry.collection.forEach((colId) => {});
		} else {
			const parsedCommand = parseHttpRequest(entry.command);
			tree[entry.id] = {
				name: entry.title ?? `${parsedCommand.method} ${parsedCommand.path}`,
				meta: {
					...parsedCommand,
					title: entry.title,
					id: entry.id,
				},
			};
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

const NoCollectionsView = () => {
	return (
		<div className="bg-bg-tertiary h-full flex items-center justify-center">
			<div className="flex flex-col items-center">
				<span className="text-text-disabled text-xl font-medium">
					No collections
				</span>
				<ReactComponents.Button variant="link">
					<Lucide.Plus className="text-fg-link" />
					New collection
				</ReactComponents.Button>
			</div>
		</div>
	);
};

export const CollectionsView = ({
	setTabs,
	tabs,
}: {
	tabs: Tab[];
	setTabs: (tabs: Tab[]) => void;
}) => {
	const x = ReactQuery.useQuery({
		queryKey: ["rest-console-collections"],
		queryFn: getCollectionsEntries,
	});

	const tree = buildTreeView(x.data ?? []);
	const selectedTabId = tabs.find((tab) => tab.selected)?.id;

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

	const selectedTabEntry = x.data?.find((entry) => entry.id === selectedTabId);

	const expandedItemIds = ["root"].concat(selectedTabEntry?.collection ?? []);

	if (x.isPending) {
		return <div>Loading...</div>;
	}

	return (
		<React.Fragment>
			{x.isSuccess && x.data?.length === 0 ? (
				<NoCollectionsView />
			) : (
				<div className="px-1 py-2">
					<ReactComponents.TreeView
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
