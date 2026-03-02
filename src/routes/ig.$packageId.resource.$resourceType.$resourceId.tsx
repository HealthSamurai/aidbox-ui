import { createFileRoute } from "@tanstack/react-router";
import { CanonicalResource } from "../components/IGBrowser/canonical-resource";

type ViewParam = "differential" | "snapshot" | "json" | "expansion";
const VALID_VIEWS = new Set<string>([
	"differential",
	"snapshot",
	"json",
	"expansion",
]);

export const Route = createFileRoute(
	"/ig/$packageId/resource/$resourceType/$resourceId",
)({
	component: CanonicalResource,
	loader: (cx) => ({ breadCrumb: cx.params.resourceId }),
	validateSearch: (search) => ({
		view: VALID_VIEWS.has(search.view as string)
			? (search.view as ViewParam)
			: undefined,
	}),
});
