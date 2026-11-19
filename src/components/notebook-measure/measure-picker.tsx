import * as HSComp from "@health-samurai/react-components";
import { ChevronDown, Gauge, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type MeasureSummary, useMeasureCandidates } from "./measure-api";
import { measureCanonical, measureLabel, plainText } from "./measure-types";

function useDebounced<T>(value: T, delay: number): T {
	const [v, setV] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setV(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);
	return v;
}

function looksLikeReference(s: string): boolean {
	const t = s.trim();
	return t.includes("://") || /^Measure\/[A-Za-z0-9\-.]+$/.test(t);
}

export function MeasurePicker({
	onChange,
	placeholder,
	className,
}: {
	onChange: (canonical: string, measure?: MeasureSummary) => void;
	placeholder?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debounced = useDebounced(search, 200);
	const { data: candidates = [], isFetching } = useMeasureCandidates(
		looksLikeReference(debounced) ? "" : debounced,
		open,
	);
	const pick = (canonical: string, m?: MeasureSummary) => {
		onChange(canonical, m);
		setOpen(false);
		setSearch("");
	};
	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					className={`h-7 px-2 justify-between font-mono text-xs bg-bg-primary hover:bg-bg-quaternary w-full ${className ?? ""}`}
				>
					<span className="truncate text-text-tertiary">
						{placeholder ?? "Select measure…"}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</HSComp.Button>
			</HSComp.PopoverTrigger>
			<HSComp.PopoverContent className="w-[640px] p-0" align="start">
				<HSComp.Command shouldFilter={false}>
					<HSComp.CommandInput
						placeholder="Search measure, or paste a canonical url…"
						value={search}
						onValueChange={setSearch}
					/>
					<HSComp.CommandList>
						{looksLikeReference(search) && (
							<HSComp.CommandItem
								value={`ref:${search}`}
								onSelect={() => pick(search.trim())}
							>
								<Link2 className="size-4 text-text-link" />
								<span className="typo-body text-text-primary">Use</span>
								<span className="typo-code text-text-secondary truncate">
									{search.trim()}
								</span>
							</HSComp.CommandItem>
						)}
						<HSComp.CommandEmpty>
							<span className="typo-body text-text-tertiary">
								{isFetching ? "Loading…" : "No measures"}
							</span>
						</HSComp.CommandEmpty>
						{candidates.map((m) => (
							<HSComp.CommandItem
								key={m.id}
								value={m.id ?? ""}
								onSelect={() => pick(measureCanonical(m), m)}
							>
								<div className="flex flex-col min-w-0 w-full">
									<div className="flex items-center gap-1.5 typo-body-xs font-mono text-text-success-primary">
										<Gauge className="size-3.5 shrink-0" />
										<span className="truncate">{m.name ?? m.id}</span>
										{m.version && (
											<span className="text-text-tertiary">v{m.version}</span>
										)}
									</div>
									<div className="typo-body text-text-primary truncate mt-0.5">
										{measureLabel(m)}
									</div>
									{m.description && (
										<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-1">
											{plainText(m.description)}
										</div>
									)}
								</div>
							</HSComp.CommandItem>
						))}
					</HSComp.CommandList>
				</HSComp.Command>
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}
