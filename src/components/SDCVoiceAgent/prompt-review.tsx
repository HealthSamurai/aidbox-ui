import { Badge, Button } from "@health-samurai/react-components";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { PromptFinding, PromptReview } from "./api";

/**
 * What a review found, under the prompt it was about.
 *
 * What is reviewed is this prompt alone — the wording saved as an
 * SDCVoicePrompt revision. A call wraps it with the context, the questionnaire's
 * questions and an instruction for ending the call, so the review is about the
 * layer a person wrote and the rewrite replaces only that.
 *
 * Findings come first and the rewrite is a button rather than an automatic
 * replacement: a prompt is the one thing on this page a person actually wrote,
 * and overwriting it before they have read why would lose work they cannot get
 * back.
 */

/** High first: a finding that could harm someone should not be below polish. */
const ORDER: Record<PromptFinding["severity"], number> = {
	high: 0,
	medium: 1,
	low: 2,
};

const ICONS = {
	high: CircleAlert,
	medium: TriangleAlert,
	low: Info,
} as const;

const TONES = {
	high: "text-fg-error-primary",
	medium: "text-fg-warning-primary",
	low: "text-fg-info-primary",
} as const;

function sortFindings(findings: PromptFinding[]) {
	return [...findings].sort(
		(left, right) => ORDER[left.severity] - ORDER[right.severity],
	);
}

/** Whether the rewrite is worth offering: an unchanged prompt is not a suggestion. */
function hasRewrite(review: PromptReview, current: string) {
	return Boolean(review.improved) && review.improved.trim() !== current.trim();
}

export function PromptReviewPanel({
	review,
	current,
	onApply,
	onDismiss,
}: {
	review: PromptReview;
	/** The prompt as it stands, so an unchanged rewrite is not offered. */
	current: string;
	onApply: (improved: string) => void;
	onDismiss: () => void;
}) {
	const findings = sortFindings(review.findings ?? []);
	const rewrite = hasRewrite(review, current);

	return (
		<section
			aria-label="Prompt review"
			data-test-id="prompt-review"
			className="flex flex-col gap-3 rounded border border-border-primary bg-bg-secondary p-3"
		>
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-text-primary typo-label">
					{findings.length
						? `${findings.length} thing${findings.length > 1 ? "s" : ""} to look at`
						: "Nothing to flag"}
				</span>
				{review.model ? (
					<Badge variant="secondary">{review.model}</Badge>
				) : null}
			</div>

			{findings.length ? (
				<ul className="flex flex-col gap-2">
					{findings.map((finding) => {
						const Icon = ICONS[finding.severity];
						return (
							<li
								key={`${finding.severity}-${finding.title}`}
								className="flex gap-2"
								data-test-id="prompt-review__finding"
								data-severity={finding.severity}
							>
								<Icon
									aria-hidden="true"
									className={`mt-0.5 size-4 shrink-0 ${TONES[finding.severity]}`}
								/>
								<div className="flex flex-col gap-0.5">
									<span className="text-text-primary typo-label">
										<span className="sr-only">{finding.severity}: </span>
										{finding.title}
									</span>
									<span className="text-text-secondary typo-label">
										{finding.detail}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="text-text-secondary typo-label">
					The prompt covers what a call needs.
				</p>
			)}

			<div className="flex flex-wrap items-center gap-2">
				{rewrite ? (
					<Button
						variant="secondary"
						size="small"
						data-test-id="prompt-review__apply-button"
						onClick={() => onApply(review.improved)}
					>
						Apply suggested prompt
					</Button>
				) : null}
				<Button
					variant="ghost"
					size="small"
					data-test-id="prompt-review__dismiss-button"
					onClick={onDismiss}
				>
					Dismiss
				</Button>
				{rewrite ? (
					<span className="text-text-tertiary typo-label">
						Replaces the text above. Nothing is saved until you save a revision.
					</span>
				) : null}
			</div>
		</section>
	);
}
