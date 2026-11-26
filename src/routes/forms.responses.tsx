import { FormsTabs } from "@aidbox-ui/components/Forms/forms-tabs";
import { ResponsesPage } from "@aidbox-ui/components/Forms/responses/page";
import { validateResponsesSearch } from "@aidbox-ui/components/Forms/responses/search";
import { createFileRoute } from "@tanstack/react-router";

function FormsResponses() {
	return (
		<FormsTabs value="responses">
			<ResponsesPage />
		</FormsTabs>
	);
}

const TITLE = "Responses";

export const Route = createFileRoute("/forms/responses")({
	component: FormsResponses,
	validateSearch: validateResponsesSearch,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});
