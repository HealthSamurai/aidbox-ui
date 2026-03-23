import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@health-samurai/react-components";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { AuditEventDetail } from "./audit-event-detail";
import {
	type AuditEventResource,
	extractCategory,
	extractClient,
	extractDetails,
	extractPatient,
	extractUser,
	formatDateTime,
} from "./utils";

export function AuditEventsTable({
	events,
	isLoading,
	onUserClick,
	onPatientClick,
	onClientClick,
}: {
	events: AuditEventResource[];
	isLoading: boolean;
	onUserClick?: (userId: string) => void;
	onPatientClick?: (patientId: string) => void;
	onClientClick?: (clientId: string) => void;
}) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const toggleExpanded = useCallback((id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Loading...
			</div>
		);
	}

	if (events.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				No audit events found
			</div>
		);
	}

	return (
		<Table stickyHeader>
			<TableHeader>
				<TableRow>
					<TableHead className="w-8" />
					<TableHead className="whitespace-nowrap">Date/time</TableHead>
					<TableHead>User</TableHead>
					<TableHead className="whitespace-nowrap">Client</TableHead>
					<TableHead>Patient</TableHead>
					<TableHead className="whitespace-nowrap">Category</TableHead>
					<TableHead>Details</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{events.map((event) => {
					const isExpanded = expandedIds.has(event.id);
					const { date, time } = formatDateTime(event.recorded);
					const user = extractUser(event);
					const clientId = extractClient(event);
					const category = extractCategory(event);
					const details = extractDetails(event);

					return (
						<EventRow
							key={event.id}
							event={event}
							isExpanded={isExpanded}
							date={date}
							time={time}
							user={user}
							clientId={clientId}
							category={category}
							details={details}
							onToggle={toggleExpanded}
							onUserClick={onUserClick}
							onPatientClick={onPatientClick}
							onClientClick={onClientClick}
						/>
					);
				})}
			</TableBody>
		</Table>
	);
}

function EventRow({
	event,
	isExpanded,
	date,
	time,
	user,
	clientId,
	category,
	details,
	onToggle,
	onUserClick,
	onPatientClick,
	onClientClick,
}: {
	event: AuditEventResource;
	isExpanded: boolean;
	date: string;
	time: string;
	user: { display: string; resourceType?: string; id?: string };
	clientId: string | null;
	category: string;
	details: string;
	onToggle: (id: string) => void;
	onUserClick?: (userId: string) => void;
	onPatientClick?: (patientId: string) => void;
	onClientClick?: (clientId: string) => void;
}) {
	return (
		<>
			<TableRow
				className={`cursor-pointer ${isExpanded ? "border-b-0 bg-bg-secondary!" : ""}`}
				onClick={() => onToggle(event.id)}
			>
				<TableCell className="w-8 px-2">
					{isExpanded ? (
						<ChevronDown className="size-4 text-text-secondary" />
					) : (
						<ChevronRight className="size-4 text-text-secondary" />
					)}
				</TableCell>
				<TableCell>
					<div className="flex flex-col">
						<span>{date}</span>
						<span className="text-text-secondary text-xs">{time}</span>
					</div>
				</TableCell>
				<TableCell className="truncate max-w-0 w-[20%]">
					{user.id && onUserClick ? (
						<button
							type="button"
							className="text-text-link hover:underline truncate"
							onClick={(e) => {
								e.stopPropagation();
								onUserClick(user.id as string);
							}}
						>
							{user.display}
						</button>
					) : (
						user.display
					)}
				</TableCell>
				<TableCell className="whitespace-nowrap">
					{clientId && onClientClick ? (
						<button
							type="button"
							className="text-text-link hover:underline truncate"
							onClick={(e) => {
								e.stopPropagation();
								onClientClick(clientId);
							}}
						>
							Client/{clientId}
						</button>
					) : clientId ? (
						`Client/${clientId}`
					) : null}
				</TableCell>
				<TableCell>
					{(() => {
						const patient = extractPatient(event);
						return patient && onPatientClick ? (
							<button
								type="button"
								className="text-text-link hover:underline truncate"
								onClick={(e) => {
									e.stopPropagation();
									onPatientClick(patient.id);
								}}
							>
								{patient.display}
							</button>
						) : patient ? (
							patient.display
						) : null;
					})()}
				</TableCell>
				<TableCell className="whitespace-nowrap">{category}</TableCell>
				<TableCell className="truncate max-w-0 w-[35%]">{details}</TableCell>
			</TableRow>
			{isExpanded && (
				<tr className="hover:bg-transparent">
					<td
						colSpan={7}
						className="p-0 border-b border-border-secondary max-w-0"
					>
						<AuditEventDetail resource={event} />
					</td>
				</tr>
			)}
		</>
	);
}
