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
	/** Unique per history entry, not per materialization. */
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

/**
 * Materializations aimed at `target`, each with its status. A status shares the
 * materialization's id, so one search covers them all.
 */
export function useMaterializationRows(target: string | undefined) {
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
			if (!found.isOk()) return [];
			const materializations = (found.value.resource.entry ?? []).map(
				(e) => e.resource as unknown as MaterializationResource,
			);

			const perMaterialization = await Promise.all(
				materializations.map(async (m) => {
					if (!m.id) return [];
					const base = {
						id: m.id,
						object: qualifiedObject(m) ?? "",
						objectType: parameterValue(m, "materializationType") ?? "view",
					};
					// A status is one resource updated in place, so every run but the
					// last lives in its history.
					const history = await client.historyInstance({
						type: "AidboxMaterializationStatus",
						id: m.id,
					});
					if (!history.isOk())
						return [{ ...base, key: m.id } as MaterializationRow];
					const versions = (history.value.resource.entry ?? []).flatMap(
						(entry) => {
							const s = entry.resource as unknown as
								| MaterializationStatusResource
								| undefined;
							if (!s?.status) return [];
							return [
								{
									...base,
									key: `${m.id}:${s.meta?.versionId ?? s.meta?.lastUpdated ?? ""}`,
									status: s.status,
									targetVersion: s.targetVersion,
									sqlHash: s.sqlHash,
									lastUpdated: s.meta?.lastUpdated,
								} as MaterializationRow,
							];
						},
					);
					return versions.length > 0
						? versions
						: [{ ...base, key: m.id } as MaterializationRow];
				}),
			);

			return perMaterialization
				.flat()
				.sort(
					(a, b) =>
						new Date(b.lastUpdated ?? 0).getTime() -
						new Date(a.lastUpdated ?? 0).getTime(),
				);
		},
	});
}
