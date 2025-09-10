import * as ReactComponents from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as Auth from "../../api/auth";
import * as Utils from "../../utils";
import type { Tab } from "./active-tabs";

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
): Record<string, ReactComponents.Item> {
	const tree: Record<string, ReactComponents.Item> = {
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
			tree[entry.id] = {
				name: entry.title ?? entry.command.split("\n")[0] ?? entry.id,
			};
			tree.oldsnippets!.children!.push(entry.id);
		}
	});

	return tree;
}

export const CollectionsView = () => {
	const x = ReactQuery.useQuery({
		queryKey: ["rest-console-collections"],
		queryFn: getCollectionsEntries,
	});

	const tree = buildTreeView(x.data ?? []);
	console.log(tree);

	return (
		<div>
			<ReactComponents.TreeView
				rootItemId="root"
				items={tree}
				selectedItemId="root"
				expandedItemIds={["root"]}
			/>
		</div>
	);
};
