import { getAidboxBaseURL } from "@aidbox-ui/utils";
import { ExternalLink } from "lucide-react";

/** The classic (CLJS) SDC UI, where forms are built and responses rendered. */
function classicUiUrl(app: "ui/sdc" | "ui/sdc/renderer", route: string) {
	const url = new URL(app, `${getAidboxBaseURL()}/`);
	url.hash = route;
	return url.toString();
}

const LIQUID_TEMPLATE_TOPIC_SYSTEM =
	"http://forms.aidbox.io/CodeSystem/library-topic";
const LIQUID_TEMPLATE_TOPIC_CODE = "liquid-template";

/**
 * A Library holding a liquid template, marked by its topic the way the classic
 * template editor marks the ones it creates. SQL libraries are told apart by
 * profile instead, so the two never overlap.
 */
export function isLiquidTemplateLibrary(resource: {
	resourceType?: string;
	topic?: { coding?: { system?: string; code?: string }[] }[];
}) {
	return (
		resource.resourceType === "Library" &&
		(resource.topic ?? []).some((topic) =>
			(topic.coding ?? []).some(
				(coding) =>
					coding.system === LIQUID_TEMPLATE_TOPIC_SYSTEM &&
					coding.code === LIQUID_TEMPLATE_TOPIC_CODE,
			),
		)
	);
}

/**
 * Where a resource opens in the classic UI: a Questionnaire in the form
 * builder (a new form while it has no id yet), a QuestionnaireResponse in the
 * renderer, a liquid template Library in the template editor. `undefined` for
 * anything else.
 */
export function classicUiLink(
	resourceType: string,
	id: string | undefined,
	isLiquidTemplate = false,
): { label: string; href: string } | undefined {
	if (resourceType === "Questionnaire") {
		const params = id ? `?${new URLSearchParams({ form: id })}` : "";
		return {
			label: "Form Builder",
			href: classicUiUrl("ui/sdc", `/forms/builder${params}`),
		};
	}
	if (resourceType === "QuestionnaireResponse" && id) {
		return {
			label: "Renderer",
			href: classicUiUrl(
				"ui/sdc/renderer",
				`/questionnaire-response/${encodeURIComponent(id)}`,
			),
		};
	}
	if (resourceType === "Library" && isLiquidTemplate && id) {
		return {
			label: "Template Editor",
			href: classicUiUrl(
				"ui/sdc",
				`/forms/builder/liquid?${new URLSearchParams({ template: id })}`,
			),
		};
	}
	return undefined;
}

/**
 * Looks like a ResourceEditor tab but leaves the page: the classic UI opens in
 * a new browser tab.
 */
export function ClassicUiTab({ label, href }: { label: string; href: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			data-test-id="resource-editor__classic-ui-tab"
			className="box-border h-10 inline-flex items-center gap-1.5 px-3 whitespace-nowrap pb-2 pt-2.5 typo-body text-text-tertiary hover:bg-bg-secondary/60 hover:text-text-tertiary_hover border-b-2 border-b-transparent focus-visible:ring-2 focus-visible:ring-utility-blue/70 focus-visible:outline-1"
		>
			{label}
			<ExternalLink aria-hidden="true" className="size-3.5" />
		</a>
	);
}
