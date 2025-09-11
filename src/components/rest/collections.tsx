import * as ReactComponents from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
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
	return JSON.parse(response.body).entry.map((entry: any) => entry.resource);
}

async function createCollectionEntry(tab: Tab) {
	return await Auth.AidboxCallWithMeta({
		method: "PUT",
		url: `/ui_snippet/${tab.id}`,
		body: JSON.stringify({
			type: "http",
			command: Utils.generateHttpRequest(tab),
		}),
	});
}

export const SaveButton = ({ tab }: { tab: Tab }) => {
	const mode: SaveCollectionButtonMode = "empty-collection";

	const handleSave = () => {
		switch (mode) {
			case "empty-collection": {
				createCollectionEntry(tab);
				break;
			}
		}
	};

	return (
		<ReactComponents.Button variant="secondary" onClick={handleSave}>
			<Lucide.Save />
			Save
		</ReactComponents.Button>
	);
};

function buildTreeView(
	entries: CollectionEntry[],
): Record<string, ReactComponents.TreeViewItem<any>> {
	const tree: Record<string, ReactComponents.TreeViewItem<any>> = {
		root: {
			name: "root",
			children: ["oldsnippets"],
		},
		oldsnippets: {
			name: "Snippets",
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
			tree.oldsnippets!.children!.push(entry.id);
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

	const expandedItemIds = ["root"].concat(
		selectedTabEntry?.collection ?? ["oldsnippets"],
	);

	if (x.isPending) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<ReactComponents.TreeView
				rootItemId="root"
				items={tree}
				selectedItemId={selectedTabId ?? "root"}
				expandedItemIds={expandedItemIds}
				customItemView={customItemView}
				onSelectItem={handleSelectItem}
			/>
		</div>
	);
};
