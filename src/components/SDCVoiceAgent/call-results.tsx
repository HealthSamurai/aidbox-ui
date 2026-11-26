import { getResourceEditorUrl } from "@aidbox-ui/components/Forms/utils";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@health-samurai/react-components";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { type CallResults, useCallResults } from "./api";

/**
 * What the call turned into: the answers as they were recorded, and the
 * resources behind them.
 *
 * Extraction runs after the call ends, so this appears empty first and fills in
 * a few seconds later. That wait is the point of showing it at all — an agent
 * whose wording sounds fine can still record the wrong answer, and this is
 * where that shows.
 */

function resourceEditorUrl(reference: string) {
	return getResourceEditorUrl(
		reference.split("/")[0] ?? "",
		reference.split("/").slice(1).join("/"),
		"?tab=edit&mode=json",
	);
}

const resourceTitleClass = "body16bold tracking-tight text-text-link";

function ResourceLink({ reference }: { reference: string }) {
	return (
		<a
			className={`inline-flex items-center gap-1 hover:underline ${resourceTitleClass}`}
			href={resourceEditorUrl(reference)}
			rel="noreferrer"
			target="_blank"
		>
			{reference}
			<ExternalLink className="size-3" />
		</a>
	);
}

type FhirResource = {
	resourceType?: string;
	item?: {
		text?: string;
		answer?: Record<string, unknown>[];
		extension?: { url?: string; [k: string]: unknown }[];
	}[];
	content?: { attachment?: { data?: string; contentType?: string } }[];
};

/** The words in a DocumentReference, whatever it is a document of. */
function attachedText(resource: FhirResource) {
	const data = resource.content?.[0]?.attachment?.data;
	if (!data) return undefined;
	try {
		return new TextDecoder().decode(
			Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
		);
	} catch {
		return undefined;
	}
}

/** One answer as text, whichever value[x] it arrived in. */
function answerText(answer?: Record<string, unknown>) {
	if (!answer) return "";
	const coding = answer.valueCoding as { display?: string; code?: string };
	if (coding) return coding.display ?? coding.code ?? "";
	if (typeof answer.valueBoolean === "boolean")
		return answer.valueBoolean ? "Yes" : "No";
	const value =
		answer.valueString ?? answer.valueInteger ?? answer.valueDecimal;
	return value === undefined ? "" : String(value);
}

function ResourceBody({ body }: { body: unknown }) {
	if (typeof body === "string") {
		return <Pre>{body}</Pre>;
	}

	const resource = (body ?? {}) as FhirResource;

	// A response reads as the answers it holds, and a document as the words it
	// carries. Everything else has no shape worth guessing at, so it reads raw.
	if (resource.resourceType === "QuestionnaireResponse" && resource.item) {
		return (
			<dl className="mt-2 flex flex-col gap-1">
				{resource.item.map((item) => (
					<div className="flex justify-between gap-4" key={item.text}>
						<dt className="text-text-secondary typo-label">{item.text}</dt>
						<dd className="shrink-0 typo-label">
							{answerText(item.answer?.[0])}
						</dd>
					</div>
				))}
			</dl>
		);
	}

	if (resource.resourceType === "DocumentReference") {
		const text = attachedText(resource);
		if (text) return <Pre>{text}</Pre>;
	}

	return <Pre>{JSON.stringify(body, null, 2)}</Pre>;
}

function Pre({ children }: { children: React.ReactNode }) {
	return (
		<pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-sm bg-bg-primary p-3 text-text-secondary typo-label">
			{children}
		</pre>
	);
}

/**
 * One resource the call produced: a link out to the console, and the thing
 * itself a click away.
 */
function ResourceDisclosure({
	reference,
	body,
}: {
	reference?: string;
	body?: unknown;
}) {
	if (!reference) return null;

	return (
		<AccordionItem value={reference}>
			<div className="flex items-center gap-2">
				<AccordionTrigger
					data-test-id="call-results__resource-toggle-button"
					data-reference={reference}
					className={`min-w-0 flex-1 py-2 ${resourceTitleClass}`}
				>
					{reference}
				</AccordionTrigger>
				<a
					aria-label={`Open ${reference} in the resource editor`}
					data-test-id="call-results__resource-link"
					className="text-text-link"
					href={resourceEditorUrl(reference)}
					rel="noreferrer"
					target="_blank"
				>
					<ExternalLink className="size-3" />
				</a>
			</div>
			{body ? (
				<AccordionContent>
					<ResourceBody body={body} />
				</AccordionContent>
			) : null}
		</AccordionItem>
	);
}

function StatusBadge({ status }: { status?: string }) {
	if (!status || status === "answered") return null;
	return (
		<Badge variant={status === "missing" ? "secondary" : "outline"}>
			{status}
		</Badge>
	);
}

/**
 * One row per question: what was asked, what was recorded, and the words that
 * back it. Across the full width the evidence gets a column of its own rather
 * than a line squeezed under the answer.
 */
function Answers({ results }: { results: CallResults }) {
	return (
		<div className="flex flex-col gap-5">
			{results.responses.map((response) => (
				<div className="flex flex-col gap-2" key={response.reference}>
					<div className="flex items-center gap-2">
						<ResourceLink reference={response.reference} />
						<Badge
							variant={
								response.status === "completed" ? "secondary" : "outline"
							}
						>
							{response.status}
						</Badge>
					</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-2/5">Question</TableHead>
								<TableHead>Recorded</TableHead>
								<TableHead>Heard</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.answers.map((answer) => (
								<TableRow
									className="align-top"
									key={answer.text}
									data-test-id="call-results__answer-row"
									data-question={answer.text}
								>
									<TableCell
										className="text-text-secondary typo-body"
										data-test-id="call-results__question-cell"
									>
										{answer.text}
									</TableCell>
									<TableCell
										className="typo-body"
										data-test-id="call-results__answer-cell"
									>
										<span
											className={
												answer.answer ? "font-medium" : "text-text-tertiary"
											}
										>
											{answer.answer ?? ""}
										</span>
										{typeof answer.confidence === "number" &&
										answer.confidence < 0.8 ? (
											<span className="ml-2 text-text-tertiary typo-label">
												{Math.round(answer.confidence * 100)}% sure
											</span>
										) : null}
									</TableCell>
									<TableCell
										className="typo-body"
										data-test-id="call-results__evidence-cell"
									>
										<div className="flex flex-wrap items-baseline gap-2">
											<StatusBadge status={answer.status} />
											{answer.evidence ? (
												<span className="text-text-secondary italic">
													“{answer.evidence}”
												</span>
											) : null}
											{answer.sourceTurn ? (
												<span className="text-text-tertiary typo-label">
													{answer.sourceTurn}
												</span>
											) : null}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			))}
		</div>
	);
}

export function CallResultsPanel({
	callId,
	enabled,
}: {
	callId?: string;
	enabled: boolean;
}) {
	const query = useCallResults(callId, enabled);

	if (!enabled || !callId) return null;

	const results = query.data;
	const failures = results?.extractionErrors ?? [];
	// the Task exists from the moment the call is placed; the answers arrive when
	// the model has finished reading the transcript. A recorded refusal ends the
	// wait too — otherwise a model that cannot answer spins here forever.
	const waiting =
		!results?.responses?.length && !failures.length && !query.isError;

	return (
		<section
			className="flex flex-col gap-3 rounded-md border border-border-primary bg-bg-secondary p-4"
			data-test-id="call-results"
		>
			<div className="flex items-center justify-between gap-2">
				<h3 className="font-medium typo-body">Extracted</h3>
				{waiting ? (
					<span className="inline-flex items-center gap-1.5 text-text-secondary typo-label">
						<LoaderCircle
							aria-hidden="true"
							className="size-3.5 animate-spin"
						/>
						Reading the transcript…
					</span>
				) : null}
			</div>

			{query.isError ? (
				<Alert variant="critical" data-test-id="call-results__error">
					<AlertTitle>Could not read the results</AlertTitle>
					<AlertDescription>{(query.error as Error).message}</AlertDescription>
				</Alert>
			) : waiting ? (
				<div className="flex flex-col gap-2 rounded-md border border-border-primary bg-bg-primary p-3">
					<p className="text-text-secondary typo-body">
						Answers from the call will show up here: each question, what was
						recorded, and the words it was read from.
					</p>
					<Skeleton className="h-5 w-2/5 bg-bg-tertiary" />
					<Skeleton className="h-10 w-full bg-bg-tertiary" />
					<Skeleton className="h-10 w-full bg-bg-tertiary" />
					<Skeleton className="h-10 w-4/5 bg-bg-tertiary" />
				</div>
			) : results ? (
				<>
					{failures.length ? (
						<Alert variant="warning" data-test-id="call-results__warning">
							<AlertTitle>
								The transcript was kept, but part of the call was not recorded
							</AlertTitle>
							{failures.map((failure) => (
								<AlertDescription key={failure}>{failure}</AlertDescription>
							))}
						</Alert>
					) : null}
					<Answers results={results} />
					{results.extracted?.length ? (
						<div className="flex flex-col border-border-primary border-t pt-2">
							<span className="pb-1 text-text-tertiary typo-label">
								Extracted from the answers
							</span>
							<Accordion type="multiple">
								{results.extracted.map((reference, index) => (
									<ResourceDisclosure
										body={results.extractedResources?.[index]}
										key={reference}
										reference={reference}
									/>
								))}
							</Accordion>
						</div>
					) : null}
					<Accordion
						className="border-border-primary border-t pt-2"
						type="multiple"
					>
						<ResourceDisclosure
							body={results.transcriptResource}
							reference={results.transcriptRef}
						/>
						<ResourceDisclosure
							body={results.provenanceResource}
							reference={results.provenance}
						/>
						<ResourceDisclosure
							body={results.taskResource}
							reference={results.task}
						/>
					</Accordion>
				</>
			) : null}
		</section>
	);
}
