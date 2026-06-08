import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { cleanEmptyValues } from "../../utils/clean-empty-values";
import { useConceptMapContext } from "./context";
import { CodeSystemPicker } from "./properties-tree";
import type { ConceptMap } from "./types";
import { isR4Like, useFhirServerVersion } from "./version";

type ParametersParameter = {
	name: string;
	resource?: unknown;
	valueBoolean?: boolean;
	valueString?: string;
	valueCode?: string;
	valueUri?: string;
	valueCanonical?: string;
	valueCoding?: {
		system?: string;
		code?: string;
		display?: string;
		version?: string;
	};
	part?: ParametersParameter[];
};

type ParametersResource = {
	resourceType: "Parameters";
	parameter?: ParametersParameter[];
};

type Match = {
	relationship?: string;
	concept?: {
		system?: string;
		code?: string;
		display?: string;
		version?: string;
	};
	originMap?: string;
};

function buildTranslateParameters({
	conceptMap,
	code,
	system,
	isR4,
}: {
	conceptMap: ConceptMap;
	code: string;
	system?: string;
	isR4: boolean;
}): ParametersResource {
	// Strip server-tracked fields (id, meta) from the inline conceptMap.
	// Aidbox $translate duplicates matches when inline.id matches a saved
	// resource — server treats it as both an inline draft AND a DB reference.
	// Sending it as an anonymous inline avoids the bug; the test still
	// reflects unsaved form changes (which was the whole point).
	const { id, meta, ...inlineCm } = cleanEmptyValues(conceptMap) as ConceptMap;
	void id;
	void meta;
	const parameter: ParametersParameter[] = [
		{ name: "conceptMap", resource: inlineCm },
		{ name: isR4 ? "code" : "sourceCode", valueCode: code },
	];
	if (system) {
		parameter.push({ name: "system", valueUri: system });
	}
	return { resourceType: "Parameters", parameter };
}

function parseTranslateResult(result: ParametersResource | undefined) {
	if (!result) return { success: undefined, message: undefined, matches: [] };
	const params = result.parameter ?? [];
	const success = params.find((p) => p.name === "result")?.valueBoolean;
	const message = params.find((p) => p.name === "message")?.valueString;
	const matches: Match[] = params
		.filter((p) => p.name === "match")
		.map((p) => {
			const parts = p.part ?? [];
			const relationship =
				parts.find((x) => x.name === "relationship")?.valueCode ??
				parts.find((x) => x.name === "equivalence")?.valueCode;
			const concept = parts.find((x) => x.name === "concept")?.valueCoding;
			const originMap =
				parts.find((x) => x.name === "originMap")?.valueCanonical ??
				parts.find((x) => x.name === "source")?.valueUri;
			return { relationship, concept, originMap };
		});
	return { success, message, matches };
}

// Unique source systems pulled from the ConceptMap (version stripped from
// canonicals). Drives both the system input shape (hidden / dropdown / text)
// and the code suggestions filter.
function getSourceSystems(conceptMap: ConceptMap): string[] {
	const set = new Set<string>();
	for (const g of conceptMap.group ?? []) {
		if (!g.source) continue;
		const url = g.source.split("|", 1)[0];
		if (url) set.add(url);
	}
	return [...set];
}

// Unique element.code values, optionally filtered by selected source system.
function getElementCodes(conceptMap: ConceptMap, system: string): string[] {
	const set = new Set<string>();
	for (const g of conceptMap.group ?? []) {
		const gs = g.source?.split("|", 1)[0];
		if (system && gs && gs !== system) continue;
		for (const el of g.element ?? []) {
			if (el.code) set.add(el.code);
		}
	}
	return [...set];
}

export function TranslatePanel({ onClose }: { onClose: () => void }) {
	const client = useAidboxClient();
	const { conceptMap } = useConceptMapContext();
	const fhirVersion = useFhirServerVersion();
	const isR4 = isR4Like(fhirVersion);

	const sourceOptions = React.useMemo(
		() => getSourceSystems(conceptMap),
		[conceptMap],
	);
	const datalistId = React.useId();

	const [code, setCode] = React.useState("");
	const [system, setSystem] = React.useState(() => sourceOptions[0] ?? "");

	const codeOptions = React.useMemo(
		() => getElementCodes(conceptMap, system),
		[conceptMap, system],
	);

	const mutation = useMutation({
		mutationFn: async (input: { code: string; system: string }) => {
			const params = buildTranslateParameters({
				conceptMap,
				code: input.code,
				system: input.system || undefined,
				isR4,
			});
			const res = await client.request<ParametersResource>({
				method: "POST",
				url: "/fhir/ConceptMap/$translate",
				body: JSON.stringify(params),
				headers: { "Content-Type": "application/json" },
			});
			if (res.isErr()) throw res.value.resource;
			return res.value.resource;
		},
	});

	const { matches } = parseTranslateResult(mutation.data);
	const oo = mutation.error as
		| {
				resourceType?: string;
				issue?: Array<{ diagnostics?: string; severity?: string }>;
		  }
		| undefined;

	const handleRun = () => {
		if (!code) return;
		mutation.mutate({ code, system });
	};

	return (
		<div className="bg-bg-secondary flex flex-col h-full">
			<div className="flex items-center justify-between h-10 px-4 border-b flex-none">
				<span className="typo-label text-text-secondary">Translation</span>
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					onClick={onClose}
					asChild
				>
					<span>
						<X size={14} />
					</span>
				</HSComp.Button>
			</div>
			<div className="px-4 py-3 border-b bg-bg-tertiary flex-none">
				<div className="flex gap-2">
					<CodeSystemPicker
						system={system}
						onChange={(next) => setSystem(next.system ?? "")}
						pinnedSystems={sourceOptions}
						variant="form"
						prefixLabel="system"
						placeholder="search CodeSystem…"
						onEnter={handleRun}
					/>
					<div className="flex-1 min-w-0 basis-0">
						<HSComp.Input
							type="text"
							className="bg-bg-primary"
							list={datalistId}
							prefixValue={
								<span className="text-nowrap text-elements-assistive font-medium">
									code
								</span>
							}
							placeholder="e.g., info"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyPress={(e) => {
								if (e.key === "Enter") handleRun();
							}}
						/>
					</div>
					<datalist id={datalistId}>
						{codeOptions.map((c) => (
							<option key={c} value={c} />
						))}
					</datalist>
					<HSComp.Button
						variant="secondary"
						onClick={handleRun}
						disabled={!code || mutation.isPending}
					>
						Translate
					</HSComp.Button>
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-auto bg-bg-primary">
				{oo?.issue && (
					<div className="m-4 rounded-md border border-border-error-primary bg-bg-error-primary/10 p-3 text-text-error-primary text-xs">
						{oo.issue.map((i, idx) => (
							<div key={`${idx}-${i.diagnostics ?? ""}`}>
								<span className="font-mono">[{i.severity ?? "error"}]</span>{" "}
								{i.diagnostics ?? "Unknown error"}
							</div>
						))}
					</div>
				)}
				{mutation.data && matches.length > 0 && (
					<HSComp.Table zebra stickyHeader className="typo-code">
						<HSComp.TableHeader className="z-0">
							<HSComp.TableRow>
								<HSComp.TableHead>Relationship</HSComp.TableHead>
								<HSComp.TableHead>Code</HSComp.TableHead>
								<HSComp.TableHead>Display</HSComp.TableHead>
								<HSComp.TableHead>System</HSComp.TableHead>
								<HSComp.TableHead>Source</HSComp.TableHead>
								<HSComp.TableHead className="w-full p-0" />
							</HSComp.TableRow>
						</HSComp.TableHeader>
						<HSComp.TableBody>
							{matches.map((m, idx) => (
								<HSComp.TableRow
									// biome-ignore lint/suspicious/noArrayIndexKey: match order is stable
									key={idx}
									zebra
									index={idx}
								>
									<HSComp.TableCell>{m.relationship ?? "—"}</HSComp.TableCell>
									<HSComp.TableCell>{m.concept?.code ?? "—"}</HSComp.TableCell>
									<HSComp.TableCell>
										{m.concept?.display ?? "—"}
									</HSComp.TableCell>
									<HSComp.TableCell className="text-text-secondary">
										{m.concept?.system ?? "—"}
										{m.concept?.version ? `|${m.concept.version}` : ""}
									</HSComp.TableCell>
									<HSComp.TableCell className="text-text-secondary">
										{m.originMap ?? "—"}
									</HSComp.TableCell>
									<HSComp.TableCell className="p-0" />
								</HSComp.TableRow>
							))}
						</HSComp.TableBody>
					</HSComp.Table>
				)}
				{mutation.data && matches.length === 0 && !oo?.issue && (
					<div className="p-4 text-text-secondary text-xs">No match</div>
				)}
			</div>
		</div>
	);
}
