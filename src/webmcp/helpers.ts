import type { AidboxClientR5 } from "../AidboxClient";

export async function rpc(
	client: AidboxClientR5,
	method: string,
	params: Record<string, unknown>,
) {
	const response = await client.rawRequest({
		method: "POST",
		url: `/rpc?_m=${method}`,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ method, params }),
	});
	const json = await response.response.json();
	return json.data ?? json.result;
}

export function textResult(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
}

export function errorResult(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}
