import { createFileRoute } from "@tanstack/react-router";
import { ExampleResource } from "../components/IGBrowser/example-resource";

export const Route = createFileRoute(
	"/ig/$packageId/example/$resourceType/$exampleId",
)({
	component: ExampleResource,
	loader: (cx) => ({ breadCrumb: cx.params.exampleId }),
});
