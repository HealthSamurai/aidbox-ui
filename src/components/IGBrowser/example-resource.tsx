import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAidboxClient } from "../../AidboxClient";
import { fetchExample } from "../../api/examples";

export function ExampleResource() {
	const { resourceType, exampleId } = useParams({
		from: "/ig/$packageId/example/$resourceType/$exampleId",
	});
	const client = useAidboxClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["ig-example", resourceType, exampleId],
		staleTime: 5 * 60 * 1000,
		queryFn: () => fetchExample(client, resourceType, exampleId),
	});

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3 p-6">
				<HSComp.Skeleton className="h-6 w-64" />
				<HSComp.Skeleton className="h-[400px] w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-text-error-primary text-sm">{error.message}</div>
		);
	}

	if (!data) {
		return (
			<div className="p-6 text-text-secondary text-sm">Example not found</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 min-h-0">
				<HSComp.CodeEditor
					readOnly
					currentValue={JSON.stringify(data, null, 2)}
					mode="json"
				/>
			</div>
		</div>
	);
}
