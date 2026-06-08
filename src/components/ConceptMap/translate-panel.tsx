import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { ArrowRightLeft, X } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { cleanEmptyValues } from "../../utils/clean-empty-values";
import { useConceptMapContext } from "./context";
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
	const parameter: ParametersParameter[] = [
		{ name: "conceptMap", resource: cleanEmptyValues(conceptMap) },
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

// Pick a reasonable default system for the user — first group with source.
function defaultSystemFromMap(conceptMap: ConceptMap): string | undefined {
	const g = conceptMap.group?.find((x) => x.source);
	const src = g?.source;
	if (!src) return undefined;
	// strip "|version" if it's a canonical with version
	return src.split("|", 1)[0];
}

export function TranslatePanel({ onClose }: { onClose: () => void }) {
	const client = useAidboxClient();
	const { conceptMap } = useConceptMapContext();
	const fhirVersion = useFhirServerVersion();
	const isR4 = isR4Like(fhirVersion);

	const [code, setCode] = React.useState("");
	const [system, setSystem] = React.useState("");

	const systemPlaceholder =
		defaultSystemFromMap(conceptMap) ?? "system (optional)";

	const mutation = useMutation({
		mutationFn: async (input: { code: string; system: string }) => {
			const params = buildTranslateParameters({
				conceptMap,
				code: input.code,
				system: input.system || defaultSystemFromMap(conceptMap),
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

	const { success, message, matches } = parseTranslateResult(mutation.data);
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
		<div className="flex-none border-t bg-bg-secondary flex flex-col max-h-[50%]">
			<div className="flex items-center justify-between h-10 px-4 border-b flex-none">
				<div className="flex items-center gap-2">
					<ArrowRightLeft size={14} className="text-text-info-primary" />
					<span className="typo-label uppercase text-text-info-primary">
						Translate
					</span>
				</div>
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
			<div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<HSComp.Input
						className="h-7 py-1 px-2 font-mono text-xs max-w-[200px]"
						placeholder="source code (required)"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleRun();
						}}
					/>
					<HSComp.Input
						className="h-7 py-1 px-2 font-mono text-xs flex-1 min-w-[200px]"
						placeholder={systemPlaceholder}
						value={system}
						onChange={(e) => setSystem(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleRun();
						}}
					/>
					<HSComp.Button
						variant="primary"
						size="small"
						onClick={handleRun}
						disabled={!code || mutation.isPending}
					>
						{mutation.isPending ? "Translating…" : "Translate"}
					</HSComp.Button>
				</div>

				{oo?.issue && (
					<div className="rounded-md border border-border-error-primary bg-bg-error-primary/10 p-3 text-text-error-primary text-xs">
						{oo.issue.map((i, idx) => (
							<div key={`${idx}-${i.diagnostics ?? ""}`}>
								<span className="font-mono">[{i.severity ?? "error"}]</span>{" "}
								{i.diagnostics ?? "Unknown error"}
							</div>
						))}
					</div>
				)}

				{mutation.data && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 typo-label">
							<span
								className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs uppercase ${
									success
										? "text-text-success-primary bg-bg-success-primary"
										: "text-text-warning-primary bg-bg-warning-primary"
								}`}
							>
								{success ? "found" : "no match"}
							</span>
							<span className="text-text-secondary">
								{matches.length} match{matches.length === 1 ? "" : "es"}
							</span>
							{message && (
								<span className="text-text-secondary text-xs">— {message}</span>
							)}
						</div>
						{matches.map((m, idx) => (
							<div
								key={`${idx}-${m.concept?.code ?? ""}`}
								className="border border-border-primary rounded-md p-3 space-y-1"
							>
								<div className="flex items-baseline gap-2">
									<span className="font-mono text-sm">
										{m.concept?.code ?? "—"}
									</span>
									{m.concept?.display && (
										<span className="text-text-secondary text-sm">
											{m.concept.display}
										</span>
									)}
								</div>
								{m.concept?.system && (
									<div className="font-mono text-xs text-text-secondary">
										system: {m.concept.system}
										{m.concept.version ? `|${m.concept.version}` : ""}
									</div>
								)}
								{m.relationship && (
									<div className="text-xs">
										<span className="text-text-secondary">relationship: </span>
										<span className="font-mono">{m.relationship}</span>
									</div>
								)}
								{m.originMap && (
									<div className="text-xs">
										<span className="text-text-secondary">via: </span>
										<span className="font-mono">{m.originMap}</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
