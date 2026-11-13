import { createFileRoute } from "@tanstack/react-router";
import { FormsTabs } from "../components/SDC/forms/forms-tabs";
import { ResponsesPage } from "../components/SDC/responses/page";
import { validateResponsesSearch } from "../components/SDC/responses/search";

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
