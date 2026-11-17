import type {
	OperationOutcome,
	OperationOutcomeIssue,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { createContext, type ReactNode, useContext } from "react";

type IssueOptions = {
	severity?: readonly OperationOutcomeIssue["severity"][];
};

const OperationOutcomeContext = createContext<OperationOutcome | null>(null);

export function OperationOutcomeProvider({
	outcome,
	children,
}: {
	outcome: OperationOutcome | null;
	children: ReactNode;
}) {
	return (
		<OperationOutcomeContext value={outcome}>
			{children}
		</OperationOutcomeContext>
	);
}

export function isOperationOutcomeError(issue: OperationOutcomeIssue) {
	return issue.severity === "error" || issue.severity === "fatal";
}

/** Strings match an expression exactly; regexes control their own matching. */
export function useOperationOutcomeIssues(
	expression?: string | RegExp,
	{ severity }: IssueOptions = {},
) {
	const outcome = useContext(OperationOutcomeContext);
	return (outcome?.issue ?? []).filter((issue) => {
		if (severity && !severity.includes(issue.severity)) return false;
		return (
			expression === undefined ||
			issue.expression?.some((path) =>
				typeof expression === "string"
					? path === expression
					: path.search(expression) !== -1,
			)
		);
	});
}

/** Read a field's error messages without modifying the outcome. */
export function useOperationOutcomeError(
	expression: string | RegExp | undefined,
) {
	const issues = useOperationOutcomeIssues(expression, {
		severity: ["error", "fatal"],
	});
	if (expression === undefined) return undefined;
	return [...new Set(issues.map(issueMessage))].join("\n") || undefined;
}

export function issueMessage(issue: OperationOutcomeIssue) {
	return issue.diagnostics ?? issue.details?.text ?? issue.code;
}
