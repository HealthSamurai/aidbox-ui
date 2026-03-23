import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DatePickerInput } from "./date-picker-input";
import { type AuditEventFilters, CATEGORY_OPTIONS } from "./utils";

function useDebouncedValue(
	value: string,
	onChange: (value: string) => void,
	delay = 300,
) {
	const [local, setLocal] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		setLocal(value);
	}, [value]);

	const handleChange = useCallback(
		(v: string) => {
			setLocal(v);
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => onChange(v), delay);
		},
		[onChange, delay],
	);

	return [local, handleChange] as const;
}

export function AuditEventsFilters({
	filters,
	onFiltersChange,
}: {
	filters: AuditEventFilters;
	onFiltersChange: (filters: AuditEventFilters) => void;
}) {
	const update = useCallback(
		(patch: Partial<AuditEventFilters>) => {
			onFiltersChange({ ...filters, ...patch });
		},
		[filters, onFiltersChange],
	);

	const [searchText, setSearchText] = useDebouncedValue(filters.search, (v) =>
		update({ search: v }),
	);
	const [userId, setUserId] = useDebouncedValue(filters.userId, (v) =>
		update({ userId: v }),
	);
	const [clientId, setClientId] = useDebouncedValue(filters.clientId, (v) =>
		update({ clientId: v }),
	);
	const [patientId, setPatientId] = useDebouncedValue(filters.patientId, (v) =>
		update({ patientId: v }),
	);

	return (
		<div className="flex flex-col gap-3 px-4 py-3 border-b border-border-secondary">
			<Input
				placeholder="Search"
				value={searchText}
				onChange={(e) => setSearchText(e.target.value)}
				leftSlot={<Search />}
			/>
			<div className="flex flex-wrap gap-4 items-end">
				<div className="flex flex-col gap-1">
					<span className="typo-label-xs text-text-secondary">Date range</span>
					<div className="flex items-center">
						<DatePickerInput
							value={filters.dateFrom}
							onChange={(v) => update({ dateFrom: v })}
							className="w-44"
						/>
						<span className="text-text-secondary text-xs px-1">—</span>
						<DatePickerInput
							value={filters.dateTo}
							onChange={(v) => update({ dateTo: v })}
							className="w-44"
						/>
					</div>
				</div>
				<div className="flex items-end gap-4">
					<div className="flex flex-col gap-1">
						<span className="typo-label-xs text-text-secondary">User</span>
						<Input
							placeholder="User ID"
							value={userId}
							onChange={(e) => setUserId(e.target.value)}
							className="w-44"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<span className="typo-label-xs text-text-secondary">Client</span>
						<Input
							placeholder="Client ID"
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							className="w-44"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<span className="typo-label-xs text-text-secondary">Patient</span>
						<Input
							placeholder="Patient ID"
							value={patientId}
							onChange={(e) => setPatientId(e.target.value)}
							className="w-44"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<span className="typo-label-xs text-text-secondary">Category</span>
					<Select
						value={filters.category}
						onValueChange={(v) => update({ category: v })}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent>
							{CATEGORY_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
