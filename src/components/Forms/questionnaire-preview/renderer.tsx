import { isR4Like } from "@aidbox-ui/components/ConceptMap/version";
import type {
	Questionnaire,
	QuestionnaireResponse,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { getAidboxBaseURL } from "@aidbox-ui/utils";
import { theme } from "@formbox/hs-theme";
import themeCss from "@formbox/hs-theme/style.css?inline";
import Renderer, {
	type QuestionnaireOf,
	type QuestionnaireResponseOf,
	useStrings,
} from "@formbox/renderer";
import { Button } from "@health-samurai/react-components";
import type { ComponentProps, FormEvent } from "react";

/*
 * The theme's CSS opens with a global preflight (borders in currentcolor,
 * transparent buttons and so on) followed by its own hashed classes. The
 * preflight is scoped to the preview so the rest of the app keeps its look;
 * the classes stay global, as popovers render outside the preview. All of it
 * sits in the base layer, under the Tailwind utilities. A CSS
 * `@import ... layer(base)` does not work: Tailwind resolves the package with
 * the "style" condition, under which `./style.css` is not exported.
 */
const PREFLIGHT_END =
	"[hidden]:where(:not([hidden=until-found])){display:none!important}";
// Should a theme update move the marker, scoping everything is the safe side.
const preflightEnd = themeCss.includes(PREFLIGHT_END)
	? themeCss.indexOf(PREFLIGHT_END) + PREFLIGHT_END.length
	: themeCss.length;
const preflight = themeCss.slice(0, preflightEnd);
const themeClasses = themeCss.slice(preflightEnd);
const style = document.createElement("style");
style.dataset.formboxTheme = "";
style.textContent = `@layer base {
@scope ([data-formbox-theme-root]) {
${preflight}
}
${themeClasses}
}`;
document.head.appendChild(style);

type FormProperties = ComponentProps<typeof theme.Form>;

/**
 * The theme's form is a single column with the buttons after the last item.
 * The preview shows it as an Aidbox UI page instead: a section heading and
 * the items on the page, and Save in a footer at the bottom. A form nobody
 * saves, such as a Questionnaire preview, has no actions. There is no Cancel:
 * the renderer's cancel only clears validation and keeps the answers.
 */
function PreviewForm({
	actions,
	onSubmit,
	children,
	title,
	description,
	languageSelector,
	errors,
	before,
	after,
	signature,
	pagination,
}: FormProperties & { actions: boolean }) {
	const strings = useStrings();
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onSubmit?.();
	};
	return (
		<form className="flex flex-col gap-6 px-8 pt-6" onSubmit={handleSubmit}>
			{(title || description || languageSelector) && (
				<header className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						{title && (
							<h2 className="text-2xl font-semibold text-text-primary">
								{title}
							</h2>
						)}
						{description && (
							<p className="mt-1 text-sm text-text-secondary">{description}</p>
						)}
					</div>
					{languageSelector}
				</header>
			)}
			{errors}
			{before}
			<div className="flex flex-col gap-4">{children}</div>
			{after}
			{pagination && (
				<div className="flex items-center gap-2 text-sm text-text-primary">
					<Button
						variant="secondary"
						size="small"
						type="button"
						onClick={pagination.onPrev}
						disabled={pagination.disabledPrev}
					>
						{strings.pagination.previous}
					</Button>
					<span>
						{pagination.current} / {pagination.total}
					</span>
					<Button
						variant="secondary"
						size="small"
						type="button"
						onClick={pagination.onNext}
						disabled={pagination.disabledNext}
					>
						{strings.pagination.next}
					</Button>
				</div>
			)}
			{(signature || actions) && (
				<footer className="sticky bottom-0 -mx-8 flex items-center gap-2 border-t border-border-primary bg-bg-primary px-8 py-3">
					{signature}
					{actions && (
						<Button type="submit" variant="primary" className="ml-auto">
							Save
						</Button>
					)}
				</footer>
			)}
		</form>
	);
}

/** The renderer hands every form a submit handler, so the theme decides. */
const submittableTheme = {
	...theme,
	Form: (properties: FormProperties) => <PreviewForm {...properties} actions />,
};
const viewOnlyTheme = {
	...theme,
	Form: (properties: FormProperties) => (
		<PreviewForm {...properties} actions={false} />
	),
};

/** Loaded lazily: the renderer and its theme are a heavy chunk of their own. */
export default function QuestionnaireRenderer({
	questionnaire,
	questionnaireResponse,
	fhirVersion,
	onResponseChange,
	onSubmit,
}: {
	questionnaire: Questionnaire;
	/** Answers to start from; edits stay in the preview. */
	questionnaireResponse?: QuestionnaireResponse;
	fhirVersion: string;
	onResponseChange: (response: object) => void;
	/** Without it the form has no Save button. */
	onSubmit?: ((response: object) => void) | undefined;
}) {
	const terminologyServerUrl = `${getAidboxBaseURL()}/fhir`;
	const previewTheme = onSubmit ? submittableTheme : viewOnlyTheme;
	return isR4Like(fhirVersion) ? (
		<Renderer
			fhirVersion="r4"
			questionnaire={questionnaire as QuestionnaireOf<"r4">}
			defaultQuestionnaireResponse={
				questionnaireResponse as QuestionnaireResponseOf<"r4"> | undefined
			}
			terminologyServerUrl={terminologyServerUrl}
			theme={previewTheme}
			onChange={onResponseChange}
			onSubmit={onSubmit}
		/>
	) : (
		<Renderer
			fhirVersion="r5"
			questionnaire={questionnaire as unknown as QuestionnaireOf<"r5">}
			defaultQuestionnaireResponse={
				questionnaireResponse as unknown as
					| QuestionnaireResponseOf<"r5">
					| undefined
			}
			terminologyServerUrl={terminologyServerUrl}
			theme={previewTheme}
			onChange={onResponseChange}
			onSubmit={onSubmit}
		/>
	);
}
