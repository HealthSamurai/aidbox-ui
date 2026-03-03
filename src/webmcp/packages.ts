import { useEffect, useRef } from "react";
import { useAidboxClient } from "../AidboxClient";
import { errorResult, rpc, textResult } from "./helpers";

export function useWebMCPPackages() {
	const client = useAidboxClient();
	const clientRef = useRef(client);
	clientRef.current = client;

	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "search_packages",
			description:
				"[FHIR Packages page] Search installed FHIR Implementation Guide packages. " +
				"Returns list of packages with id (name#version), name, version, and type (direct/transitive). " +
				"Use without query to list all packages. " +
				"The UI shows these on the /ig page as a searchable table.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Filter packages by name (e.g. 'r4', 'us.core', 'terminology')",
					},
				},
			},
			execute: async (args: { query?: string }) => {
				try {
					const data = await rpc(
						clientRef.current,
						"aidbox.profiles/list-packages",
						{},
					);
					const packages = (data ?? []).map((pkg: Record<string, unknown>) => {
						const name = (pkg.name as string) ?? "";
						const version = (pkg.version as string) ?? "";
						return {
							id: `${name}#${version}`,
							name,
							version,
							type: ((pkg.installation as { intention: string }[]) ?? [])
								.map((i) => i.intention)
								.filter(Boolean)
								.join(", "),
						};
					});

					const query = args.query?.toLowerCase();
					const filtered = query
						? packages.filter(
								(p: { id: string; type: string }) =>
									p.id.toLowerCase().includes(query) ||
									p.type.toLowerCase().includes(query),
							)
						: packages;

					return textResult(filtered);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "search_canonicals",
			description:
				"[FHIR Packages page] Search canonical resources (StructureDefinition, ValueSet, CodeSystem, etc.) " +
				"within a specific FHIR package. Returns resourceType, id, and url for each match. " +
				"The UI shows these on the package detail page (/ig/{packageId}) in the Canonicals tab.",
			inputSchema: {
				type: "object",
				properties: {
					packageId: {
						type: "string",
						description:
							"Package ID in name#version format (e.g. 'hl7.fhir.r4.core#4.0.1')",
					},
					query: {
						type: "string",
						description:
							"Filter by resource type or URL (e.g. 'Patient', 'ValueSet')",
					},
					count: {
						type: "number",
						description: "Results per page (default: 50)",
					},
					page: {
						type: "number",
						description: "Page number, starting from 1 (default: 1)",
					},
				},
				required: ["packageId"],
			},
			execute: async (args: {
				packageId: string;
				query?: string;
				count?: number;
				page?: number;
			}) => {
				try {
					const result = await rpc(
						clientRef.current,
						"aidbox.introspector/search-package-canonicals",
						{
							"package-coordinate": args.packageId,
							...(args.query ? { substring: args.query } : {}),
							count: args.count ?? 50,
							page: args.page ?? 1,
						},
					);

					const { total = 0, entry = [] } = result ?? {};
					const entries = entry.map(
						(e: { resource: Record<string, string> }) => ({
							resourceType: e.resource.resourceType,
							id: e.resource.id,
							url: e.resource.url,
						}),
					);

					return textResult({ total, entries });
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		return () => {
			navigator.modelContext?.unregisterTool("search_packages");
			navigator.modelContext?.unregisterTool("search_canonicals");
		};
	}, []);
}
