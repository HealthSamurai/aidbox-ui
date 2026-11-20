import { FormsTabs } from "@aidbox-ui/components/Forms/forms-tabs";
import { TemplatesPage } from "@aidbox-ui/components/Forms/templates/page";
import { validateTemplatesSearch } from "@aidbox-ui/components/Forms/templates/search";
import { createFileRoute } from "@tanstack/react-router";

function FormsTemplates() {
	return (
		<FormsTabs value="templates">
			<TemplatesPage />
		</FormsTabs>
	);
}

const TITLE = "Templates";

export const Route = createFileRoute("/forms/templates")({
	component: FormsTemplates,
	validateSearch: validateTemplatesSearch,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});
