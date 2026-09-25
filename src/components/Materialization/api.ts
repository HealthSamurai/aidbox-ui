import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";
import {
	type MaterializationResource,
	parameterValue,
	qualifiedObject,
} from "./types";

export type MaterializationStatusResource = {
	id?: string;
	status?: string;
	targetVersion?: string;
	sqlHash?: string;
	meta?: { lastUpdated?: string; versionId?: string };
};

export type MaterializationRow = {
	/** Materialization id for the list; id plus versionId for a run. */
	key: string;
	id: string;
	object: string;
	objectType: string;
	status?: string;
	targetVersion?: string;
	sqlHash?: string;
	lastUpdated?: string;
};

export const materializationsKey = (target: string | undefined) => [
	"aidbox-materializations",
	target ?? "",
];

export const runsKey = (id: string | undefined) => [
	"aidbox-materialization-runs",
	id ?? "",
];

const describe = (m: MaterializationResource) => ({
	id: m.id ?? "",
	object: qualifiedObject(m) ?? "",
	objectType: parameterValue(m, "materializationType") ?? "view",
});

/** The Materializations aimed at `target`, one row each, showing where each stands. */
export function useMaterializations(target: string | undefined) {
	const client = useAidboxClient();
	return useQuery<MaterializationRow[]>({
		queryKey: materializationsKey(target),
		enabled: Boolean(target),
		queryFn: async () => {
			const found = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/AidboxMaterialization",
				params: [
					["target", target ?? ""],
					["_count", "100"],
				],
			});
			// Not swallowed: an empty list is what offers to create one, so a failed
			// search must not look like an empty one.
			if (!found.isOk())
				throw new Error(
					parseOperationOutcome(found.value.resource)
						.map(
							({ expression, diagnostics }) => `${expression}: ${diagnostics}`,
						)
						.join("; ") || "Could not search AidboxMaterialization",
					{ cause: found.value.resource },
				);
			const materializations = (found.value.resource.entry ?? [])
				.map((e) => e.resource as unknown as MaterializationResource)
				.filter((m) => m.id);
			if (materializations.length === 0) return [];

			// A status shares its materialization's id, so one search covers them all.
			const statuses = new Map<string, MaterializationStatusResource>();
			const result = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/AidboxMaterializationStatus",
				params: [
					["_id", materializations.map((m) => m.id).join(",")],
					["_count", "100"],
				],
			});
			// Lenient by contrast: without it the rows still list, minus their status.
			if (result.isOk()) {
				for (const entry of result.value.resource.entry ?? []) {
					const s = entry.resource as unknown as MaterializationStatusResource;
					if (s.id) statuses.set(s.id, s);
				}
			}

			return materializations.map((m) => {
				const base = describe(m);
				const s = statuses.get(base.id);
				return {
					...base,
					key: base.id,
					status: s?.status,
					targetVersion: s?.targetVersion,
					sqlHash: s?.sqlHash,
					lastUpdated: s?.meta?.lastUpdated,
				};
			});
		},
	});
}

/**
 * Every run of one Materialization, newest first. A status is updated in place,
 * so the trail is its history.
 */
export function useMaterializationRuns(id: string | undefined) {
	const client = useAidboxClient();
	return useQuery<MaterializationRow[]>({
		queryKey: runsKey(id),
		enabled: Boolean(id),
		queryFn: async () => {
			if (!id) return [];
			const base = { id, object: "", objectType: "" };

			const history = await client.historyInstance({
				type: "AidboxMaterializationStatus",
				id,
			});
			// A materialization that has never run has no status at all, which is not
			// an error — it is the empty run log.
			if (!history.isOk()) return [];
			const versions = (history.value.resource.entry ?? []).flatMap((entry) => {
				const s = entry.resource as unknown as
					| MaterializationStatusResource
					| undefined;
				if (!s?.status) return [];
				return [
					{
						// A delete is recorded as a version, and Aidbox keeps the body on
						// it, so it would otherwise read as one more run.
						deleted: entry.request?.method === "DELETE",
						row: {
							...base,
							key: `${id}:${s.meta?.versionId ?? s.meta?.lastUpdated ?? ""}`,
							status: s.status,
							targetVersion: s.targetVersion,
							sqlHash: s.sqlHash,
							lastUpdated: s.meta?.lastUpdated,
						} as MaterializationRow,
					},
				];
			});
			const newestFirst = versions.sort(
				(a, b) =>
					new Date(b.row.lastUpdated ?? 0).getTime() -
					new Date(a.row.lastUpdated ?? 0).getTime(),
			);
			// Everything at or before the newest delete belongs to a status that no
			// longer exists; only what came after it is this resource's trail.
			const deletedAt = newestFirst.findIndex((v) => v.deleted);
			const live = (
				deletedAt === -1 ? newestFirst : newestFirst.slice(0, deletedAt)
			).map((v) => v.row);
			// Every run opens with in-progress and then overwrites it, so a finished
			// run leaves one behind. Only the newest can still be live.
			return live.filter((row, i) => i === 0 || row.status !== "in-progress");
		},
	});
}
