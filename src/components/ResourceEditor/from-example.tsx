import {
	Button,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Search } from "lucide-react";
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
		return examples.filter(
			(e) =>
				e["resource-id"]?.toLowerCase().includes(q) ||
				e.name?.toLowerCase().includes(q) ||
				e.package?.toLowerCase().includes(q),
		);
	}, [examples, search]);

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
					Create from example
					<ChevronDown size={12} />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="start">
				<div className="flex items-center gap-2 border-b px-3 py-2">
					<Search size={14} className="text-text-tertiary shrink-0" />
					<input
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
						placeholder="Search examples..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<div className="max-h-60 overflow-y-auto">
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
					{filtered.map((entry) => (
						<button
							type="button"
							key={entry.id}
							className={cn(
								"w-full text-left px-3 py-2 text-sm",
								"hover:bg-bg-quaternary cursor-pointer",
								"flex flex-col gap-0.5",
							)}
							onClick={() => handleSelect(entry)}
						>
							<span className="font-medium">
								{entry["resource-id"] || entry.name || entry.id}
							</span>
							{entry.package && (
								<span className="text-xs text-text-tertiary">
									{entry.package}
									{entry["package-version"]
										? `#${entry["package-version"]}`
										: ""}
								</span>
							)}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
