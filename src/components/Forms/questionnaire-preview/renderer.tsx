import { isR4Like } from "@aidbox-ui/components/ConceptMap/version";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { getAidboxBaseURL } from "@aidbox-ui/utils";
import { theme } from "@formbox/hs-theme";
import themeCss from "@formbox/hs-theme/style.css?inline";
import Renderer, { type QuestionnaireOf } from "@formbox/renderer";

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

/** Loaded lazily: the renderer and its theme are a heavy chunk of their own. */
export default function QuestionnaireRenderer({
	questionnaire,
	fhirVersion,
	onResponseChange,
}: {
	questionnaire: Questionnaire;
	fhirVersion: string;
	onResponseChange: (response: object) => void;
}) {
	const terminologyServerUrl = `${getAidboxBaseURL()}/fhir`;
	return isR4Like(fhirVersion) ? (
		<Renderer
			fhirVersion="r4"
			questionnaire={questionnaire as QuestionnaireOf<"r4">}
			terminologyServerUrl={terminologyServerUrl}
			theme={theme}
			onChange={onResponseChange}
		/>
	) : (
		<Renderer
			fhirVersion="r5"
			questionnaire={questionnaire as unknown as QuestionnaireOf<"r5">}
			terminologyServerUrl={terminologyServerUrl}
			theme={theme}
			onChange={onResponseChange}
		/>
	);
}
