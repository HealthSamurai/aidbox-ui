import * as HSComp from "@health-samurai/react-components";
import { type Node, Panel, useReactFlow, useStore } from "@xyflow/react";
import { Search } from "lucide-react";
import * as React from "react";
import type { LineageNodeData } from "./types";

function nodeLabel(data: LineageNodeData): string {
	if (data.kind === "resource-type") return data.resourceType;
	return data.title || data.name || data.id;
}

function nodeKind(data: LineageNodeData): string {
	if (data.kind === "resource-type") return "Resource";
	if (data.kind === "view-definition") return "ViewDefinition";
	return data.libraryKind === "sql-view" ? "SQLView" : "SQLQuery";
}

export function NodeSearch({ onSelect }: { onSelect: (id: string) => void }) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const { setCenter } = useReactFlow();
	const nodes = useStore((s) => s.nodes as unknown as Node<LineageNodeData>[]);

	const filtered = React.useMemo(() => {
		const q = search.trim().toLowerCase();
		const all = nodes.map((n) => ({
			id: n.id,
			label: nodeLabel(n.data),
			kind: nodeKind(n.data),
			x: n.position.x + (n.measured?.width ?? 200) / 2,
			y: n.position.y + (n.measured?.height ?? 100) / 2,
		}));
		if (!q) return all.slice(0, 50);
		return all.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 50);
	}, [nodes, search]);

	const handlePick = (id: string, x: number, y: number) => {
		onSelect(id);
		setCenter(x, y, { zoom: 1, duration: 400 });
		setOpen(false);
		setSearch("");
	};

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	return (
		<Panel position="top-left">
			<HSComp.Popover open={open} onOpenChange={setOpen}>
				<HSComp.PopoverTrigger asChild>
					<HSComp.IconButton
						variant="ghost"
						aria-label="Search nodes"
						icon={<Search />}
						className="bg-bg-primary border border-border-primary size-9"
					/>
				</HSComp.PopoverTrigger>
				<HSComp.PopoverContent
					className="w-[320px] p-0"
					align="start"
					sideOffset={4}
				>
					<HSComp.Command shouldFilter={false}>
						<HSComp.CommandInput
							placeholder="Search by name…"
							value={search}
							onValueChange={setSearch}
						/>
						<HSComp.CommandList>
							<HSComp.CommandEmpty>No nodes found</HSComp.CommandEmpty>
							{filtered.map((n) => (
								<HSComp.CommandItem
									key={n.id}
									value={n.id}
									onSelect={() => handlePick(n.id, n.x, n.y)}
								>
									<div className="flex flex-col gap-0.5 min-w-0">
										<span className="typo-label-tiny text-text-tertiary">
											{n.kind}
										</span>
										<span className="truncate">{n.label}</span>
									</div>
								</HSComp.CommandItem>
							))}
						</HSComp.CommandList>
					</HSComp.Command>
				</HSComp.PopoverContent>
			</HSComp.Popover>
		</Panel>
	);
}
