import { createFileRoute } from "@tanstack/react-router";
import { FormsTabs } from "../components/SDC/forms/forms-tabs";
import { FormsPage } from "../components/SDC/forms/page";
import { validateFormsSearch } from "../components/SDC/forms/search";

function FormsIndex() {
	return (
		<FormsTabs>
			<FormsPage />
		</FormsTabs>
	);
}

export const Route = createFileRoute("/forms/")({
	component: FormsIndex,
	validateSearch: validateFormsSearch,
});
