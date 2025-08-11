import { Button, Label, Textarea } from "@panthevm_original/react-components";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/rest-console")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

async function sendAidboxRequest(requestText: string) {
	const baseUrl = import.meta.env.VITE_AIDBOX_BASE_URL;
	if (!baseUrl) {
		throw new Error("AIDBOX_BASE_URL environment variable is not configured");
	}

	const lines = requestText.trim().split("\n");
	const [method, path] = lines[0].split(" ", 2);

	let body: string | undefined;
	if (lines.length > 1) {
		body = lines.slice(1).join("\n").trim();
	}

	const url = `${baseUrl}${path}`;
	const options: RequestInit = {
		method: method.toUpperCase(),
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	};

	if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
		options.body = body;
	}

	const response = await fetch(url, options);
	const responseText = await response.text();

	try {
		const json = JSON.parse(responseText);
		return {
			status: response.status,
			statusText: response.statusText,
			data: json,
		};
	} catch {
		return {
			status: response.status,
			statusText: response.statusText,
			data: responseText,
		};
	}
}

function RouteComponent() {
	const [request, setRequest] = React.useState("GET /Patient");
	const [response, setResponse] = React.useState("");
	const [hasSubmitted, setHasSubmitted] = React.useState(false);

	const mutation = useMutation({
		mutationFn: sendAidboxRequest,
		onSuccess: (data) => {
			setResponse(JSON.stringify(data, null, 2));
		},
		onError: (error) => {
			setResponse(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		},
	});

	const handleSend = () => {
		setHasSubmitted(true);
		mutation.mutate(request);
	};

	return (
		<div className="h-screen flex flex-col p-4">
			<h1 className="text-2xl font-bold mb-4">REST Console</h1>

			<div className="space-y-2 mb-4">
				<Label htmlFor="request">HTTP Request</Label>
				<Textarea
					id="request"
					value={request}
					onChange={(e) => setRequest(e.target.value)}
					className="h-32 font-mono text-sm"
					placeholder="GET /Patient"
				/>
			</div>

			<Button
				onClick={handleSend}
				disabled={mutation.isPending}
				className="mb-4 w-fit"
			>
				Send
			</Button>

			{hasSubmitted && (
				<div className="space-y-2 flex-1 flex flex-col">
					<Label htmlFor="response">Response</Label>
					<pre className="flex-1 p-3 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm overflow-auto">
						{response}
					</pre>
				</div>
			)}
		</div>
	);
}
