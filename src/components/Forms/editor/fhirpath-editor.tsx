import { useFhirPathLsp } from "@aidbox-ui/components/ViewDefinition/fhirpath-lsp-context";
import { useGetStructureDefinitions } from "@aidbox-ui/hooks/useGetStructureDefinition";
import {
	type CompletionContext,
	closeCompletion,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	bracketMatching,
	defaultHighlightStyle,
	LRLanguage,
	syntaxHighlighting,
} from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, tooltips } from "@codemirror/view";
import { cn, EditorInput } from "@health-samurai/react-components";
import { parser } from "lezer-fhirpath";
import { useId, useMemo } from "react";
import { fhirpathVariable } from "./fhirpath";
import { fhirpathDiagnostics } from "./fhirpath-diagnostics";
import { fhirpathFieldCompletion } from "./fhirpath-fields";

export type FhirpathVariable = {
	name: string;
	description: string;
	resourceType?: string;
};

const language = LRLanguage.define({
	name: "fhirpath",
	parser,
	languageData: {
		commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
	},
});

/** Complete the entire external variable, including IDs that need quoting. */
function completeFhirpathVariables(
	variables: FhirpathVariable[],
	context: CompletionContext,
) {
	const token = context.matchBefore(/%(?:`[^`]*`?|[A-Za-z0-9_.-]*)/);
	if (!token && !context.explicit) return null;
	const node = parser
		.parse(context.state.doc.toString())
		.resolveInner(context.pos, -1);
	if (["String", "LineComment", "BlockComment"].includes(node.name))
		return null;
	return {
		from: token?.from ?? context.pos,
		options: variables.map((variable) => ({
			label: fhirpathVariable(variable.name),
			detail: variable.description,
			type: "variable",
		})),
		validFor: /^%[A-Za-z0-9_.`-]*$/,
	};
}

/** The shared CodeMirror input with FHIRPath syntax and PlanDefinition-aware completion. */
export function FhirpathEditor({
	value,
	onChange,
	variables,
	label,
	invalid,
	describedBy,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	variables: FhirpathVariable[];
	label: string;
	invalid?: boolean;
	describedBy?: string;
	className?: string;
}) {
	const id = useId();
	const { createPlugin } = useFhirPathLsp();
	const getStructureDefinitions = useGetStructureDefinitions();
	const lsp = useMemo(
		() => createPlugin(`file:///formbox/${encodeURIComponent(id)}.fhirpath`),
		[createPlugin, id],
	);
	const extensions = useMemo(
		() => [
			language,
			syntaxHighlighting(defaultHighlightStyle),
			bracketMatching(),
			EditorView.lineWrapping,
			lsp,
			fhirpathDiagnostics(variables),
			tooltips({ position: "fixed", parent: document.body }),
			Prec.highest(
				keymap.of(
					completionKeymap.map((binding) => ({
						...binding,
						stopPropagation: true,
					})),
				),
			),
			EditorView.domEventHandlers({
				blur: (_event, view) => {
					closeCompletion(view);
				},
			}),
			hoverTooltip((view, position) => {
				const text = view.state.doc.toString();
				for (const match of text.matchAll(/%(?:`([^`]+)`|([A-Za-z0-9_-]+))/g)) {
					if (
						position < match.index ||
						position > match.index + match[0].length
					)
						continue;
					const variable = variables.find(
						({ name }) => name === (match[1] ?? match[2]),
					);
					if (!variable) return null;
					return {
						pos: match.index,
						end: match.index + match[0].length,
						create: () => {
							const dom = document.createElement("div");
							dom.className = "p-2 text-sm";
							dom.textContent = `${variable.description}${variable.resourceType ? ` (${variable.resourceType})` : ""}`;
							return { dom };
						},
					};
				}
				return null;
			}),
			EditorView.contentAttributes.of({
				"aria-label": label,
				"aria-invalid": String(Boolean(invalid)),
				...(describedBy && { "aria-describedby": describedBy }),
			}),
			language.data.of({
				autocomplete: (context: CompletionContext) =>
					completeFhirpathVariables(variables, context),
			}),
			language.data.of({
				autocomplete: fhirpathFieldCompletion(
					variables,
					getStructureDefinitions,
				),
			}),
		],
		[variables, label, invalid, describedBy, lsp, getStructureDefinitions],
	);
	return (
		<div
			className={cn(
				"w-max min-w-[min(12rem,100%)] max-w-full text-sm [&_.cm-content]:h-auto! [&_.cm-content]:min-h-8! [&_.cm-content]:w-full [&_.cm-content]:min-w-0 [&_.cm-content]:px-2! [&_.cm-content]:py-[5px]! [&_.cm-content]:font-mono! [&_.cm-content]:leading-5! [&_.cm-scroller]:min-w-0",
				invalid && "[&_.cm-content]:border-border-error!",
				className,
			)}
			data-test-id="fhirpath-editor"
		>
			<EditorInput
				id={id}
				currentValue={value}
				defaultValue={value}
				onChange={onChange}
				additionalExtensions={extensions}
			/>
		</div>
	);
}
