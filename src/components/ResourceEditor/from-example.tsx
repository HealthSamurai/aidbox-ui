import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import {
	BookOpen,
	ChevronDown,
	ChevronRight,
	ScrollText,
	Search,
} from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	type ExampleEntry,
	fetchExample,
	fetchExamples,
} from "../../api/examples";

export function FromExampleButton({
	resourceType,
	onSelect,
}: {
	resourceType: string;
	onSelect: (resource: Record<string, unknown>) => void;
}) {
	const client = useAidboxClient();
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

	const { data: examples } = useQuery({
		queryKey: ["examples", resourceType],
		queryFn: () => fetchExamples(client, resourceType),
		enabled: open,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const filtered = React.useMemo(() => {
		if (!examples) return [];
		if (!search) return examples;
		const q = search.toLowerCase();
		return examples.filter((e) => {
			const hay = [e["resource-id"], e.name, e.package, ...(e.profiles ?? [])]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return hay.includes(q);
		});
	}, [examples, search]);

	const grouped = React.useMemo(() => {
		const groups: { key: string; entries: ExampleEntry[] }[] = [];
		const map = new Map<string, ExampleEntry[]>();
		for (const entry of filtered) {
			const key = entry.package
				? `${entry.package}${entry["package-version"] ? `#${entry["package-version"]}` : ""}`
				: "";
			let list = map.get(key);
			if (!list) {
				list = [];
				map.set(key, list);
				groups.push({ key, entries: list });
			}
			list.push(entry);
		}
		return groups;
	}, [filtered]);

	const handleSelect = async (entry: ExampleEntry) => {
		const resource = await fetchExample(client, resourceType, entry.id);
		if (resource) {
			const {
				id: _,
				package: _pkg,
				packageVersion: _pkgVer,
				...clean
			} = resource;
			onSelect(clean);
		}
		setOpen(false);
		setSearch("");
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="small" className="gap-1.5">
					<BookOpen size={14} />
					Examples
					<ChevronDown size={12} />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[480px] p-0 mr-2" align="end">
				<div className="flex items-center gap-2 border-b px-3 py-2">
					<Search size={14} className="text-text-tertiary shrink-0" />
					<input
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
						placeholder="Search examples..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<div className="max-h-80 overflow-y-auto px-3 pr-3 pt-1">
					{!examples && (
						<div className="px-3 py-4 text-sm text-text-tertiary text-center">
							Loading...
						</div>
					)}
					{filtered.length === 0 && examples && (
						<div className="px-3 py-4 text-sm text-text-tertiary text-center">
							No examples found
						</div>
					)}
					{grouped.map((group) => (
						<div key={group.key}>
							{group.key && (
								<button
									type="button"
									className="flex w-full items-center gap-2.5 pl-px pt-3 pb-2 typo-label-xs text-text-tertiary uppercase cursor-pointer hover:text-text-secondary"
									onClick={() =>
										setCollapsed((prev) => ({
											...prev,
											[group.key]: !prev[group.key],
										}))
									}
								>
									<ChevronRight
										className={`size-3 transition-transform duration-150 ${!collapsed[group.key] || search ? "rotate-90" : ""}`}
									/>
									{group.key}
								</button>
							)}
							{(search || !group.key || !collapsed[group.key]) &&
								group.entries.map((entry) => (
									<button
										type="button"
										key={entry.id}
										className="flex w-full items-center gap-2 text-left py-1.5 px-2 ml-4 rounded cursor-pointer hover:bg-bg-secondary"
										onClick={() => handleSelect(entry)}
									>
										<ScrollText className="size-3.5 shrink-0 text-text-tertiary" />
										<span className="truncate">
											<span className="typo-code text-text-body">
												{entry["resource-id"] || entry.name || entry.id}
											</span>
											{entry.profiles && entry.profiles.length > 0 && (
												<span className="typo-body-xs text-text-tertiary ml-2">
													{entry.profiles.join(", ")}
												</span>
											)}
										</span>
									</button>
								))}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
