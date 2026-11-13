import { createFileRoute } from "@tanstack/react-router";
import { FormsTabs } from "../components/SDC/forms/forms-tabs";
import { TemplatesPage } from "../components/SDC/templates/page";
import { validateTemplatesSearch } from "../components/SDC/templates/search";

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
