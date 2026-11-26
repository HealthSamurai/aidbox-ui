import {
	type Diagnostic,
	linter,
	setDiagnosticsEffect,
} from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { fhirpathVariables } from "./fhirpath";

/** Allow blank drafts and external variables the published LSP does not know. */
export function fhirpathDiagnostics(variables: { name: string }[]) {
	const known = new Set(variables.map(({ name }) => name));
	return [
		linter(null, {
			markerFilter: (diagnostics: readonly Diagnostic[], state) => {
				if (!state.doc.toString().trim()) return [];
				return diagnostics.filter(({ message }) => {
					const prefix = "Unknown user variable: ";
					if (!message.startsWith(prefix)) return true;
					const names = fhirpathVariables(message.slice(prefix.length));
					return names.size !== 1 || !known.has([...names][0] ?? "");
				});
			},
		}),
		// Clear previous errors immediately, before the language server responds.
		EditorState.transactionExtender.of((transaction) =>
			transaction.docChanged && !transaction.newDoc.toString().trim()
				? { effects: setDiagnosticsEffect.of([]) }
				: null,
		),
	];
}
