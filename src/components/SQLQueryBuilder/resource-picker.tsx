import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { SQL_QUERY_TYPE_CODE, SQL_QUERY_TYPE_SYSTEM } from "./types";

type CandidateKind = "ViewDefinition" | "SQLQuery";

type CandidateOption = {
	url: string;
	kind: CandidateKind;
	id: string;
	name?: string;
	title?: string;
	description?: string;
};

type RawCandidate = {
	id: string;
	url: string;
	name?: string;
	title?: string;
	description?: string;
};

const SQL_QUERY_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_QUERY_TYPE_CODE}`;

function useDebouncedValue<T>(value: T, delay: number): T {
	const [v, setV] = React.useState(value);
	React.useEffect(() => {
		const id = setTimeout(() => setV(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);
	return v;
}

function useCandidates(search: string) {
	const client = useAidboxClient();
	const debouncedSearch = useDebouncedValue(search, 200);
	return useQuery<CandidateOption[]>({
		queryKey: ["sqlquery-depends-on-candidates", debouncedSearch],
		queryFn: async () => {
			const baseParams: Array<[string, string]> = [
				["_count", "30"],
				["url:missing", "false"],
			];
			if (debouncedSearch) baseParams.push(["_ilike", debouncedSearch]);
			const [vd, lib] = await Promise.all([
				client.request<Bundle>({
					method: "GET",
					url: "/fhir/ViewDefinition",
					params: baseParams,
				}),
				client.request<Bundle>({
					method: "GET",
					url: "/fhir/Library",
					params: [...baseParams, ["type", SQL_QUERY_TYPE_TOKEN]],
				}),
			]);
			const out: CandidateOption[] = [];
			if (vd.isOk()) {
				for (const entry of vd.value.resource.entry ?? []) {
					const r = entry.resource as unknown as RawCandidate;
					out.push({
						url: r.url,
						kind: "ViewDefinition",
						id: r.id,
						name: r.name,
						title: r.title,
						description: r.description,
					});
				}
			}
			if (lib.isOk()) {
				for (const entry of lib.value.resource.entry ?? []) {
					const r = entry.resource as unknown as RawCandidate;
					out.push({
						url: r.url,
						kind: "SQLQuery",
						id: r.id,
						name: r.name,
						title: r.title,
						description: r.description,
					});
				}
			}
			return out;
		},
	});
}

export function ResourcePicker({
	value,
	onChange,
	className,
}: {
	value: string | undefined;
	onChange: (reference: string) => void;
	className?: string;
}) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const { data: candidates = [] } = useCandidates(open ? search : "");

	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					className={`h-7 px-2 justify-between font-mono text-xs bg-bg-primary hover:bg-bg-quaternary group-hover/tree-item-label:bg-bg-tertiary w-full ${value ? "text-text-primary! hover:text-text-primary!" : ""} ${className ?? ""}`}
					onClick={(e) => e.stopPropagation()}
				>
					<span className={`truncate ${value ? "" : "text-text-tertiary"}`}>
						{value || "Pick resource…"}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</HSComp.Button>
			</HSComp.PopoverTrigger>
			<HSComp.PopoverContent className="w-[420px] p-0" align="start">
				<HSComp.Command shouldFilter={false}>
					<HSComp.CommandInput
						placeholder="Search ViewDefinition or Library…"
						value={search}
						onValueChange={setSearch}
					/>
					<HSComp.CommandList>
						<HSComp.CommandEmpty>No matches</HSComp.CommandEmpty>
						{candidates.map((c) => {
							const label = c.title || c.name || c.id;
							const secondary = c.description || c.url;
							return (
								<HSComp.CommandItem
									key={c.url}
									value={c.url}
									onSelect={() => {
										onChange(c.url);
										setOpen(false);
									}}
								>
									<div className="flex flex-col gap-0.5 min-w-0 w-full">
										<span className="typo-label-tiny text-text-tertiary">
											{c.kind}
										</span>
										<span className="truncate">{label}</span>
										<span className="font-mono text-xs text-text-tertiary truncate">
											{secondary}
										</span>
									</div>
								</HSComp.CommandItem>
							);
						})}
					</HSComp.CommandList>
				</HSComp.Command>
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}
