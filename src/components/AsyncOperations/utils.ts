import type { AsyncOperationStatus, DisplayStatus } from "./types";

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return "—";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleString();
}

export function displayStatus(
	status: AsyncOperationStatus | "not-found",
	running: number,
	active: number,
): DisplayStatus | "not-found" {
	return status === "in-progress" && running === 0 && active > 0
		? "queued"
		: status;
}
