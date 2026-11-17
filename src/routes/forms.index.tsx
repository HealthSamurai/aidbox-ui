import { FormsTabs } from "@aidbox-ui/components/Forms/forms-tabs";
import { FormsPage } from "@aidbox-ui/components/Forms/page";
import { validateFormsSearch } from "@aidbox-ui/components/Forms/search";
import { createFileRoute } from "@tanstack/react-router";

function FormsIndex() {
	return (
		<FormsTabs value="forms">
			<FormsPage />
		</FormsTabs>
	);
}

export const Route = createFileRoute("/forms/")({
	component: FormsIndex,
	validateSearch: validateFormsSearch,
});
