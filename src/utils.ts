import type { Header, Tab } from "./components/rest/active-tabs";

export function getAidboxBaseURL(): string {
	const cookies = document.cookie.split("; ");
	for (const cookie of cookies) {
		const [name, rest] = cookie.split("=");
		if (name === "aidbox-base-url") {
			return decodeURIComponent(rest ?? "");
		}
	}

	const vite_base_url = import.meta.env.VITE_AIDBOX_BASE_URL;
	if (vite_base_url) {
		return vite_base_url;
	}
	return `${window.location.protocol}//${window.location.host}`;
}

export function parseHttpRequest(rawText: string): {
	method: string;
	path: string;
	headers: Header[];
	body: string;
} {
	const lines = rawText.split("\n");
	let method = "GET";
	let path = "";
	const headers: Header[] = [];
	const bodyLines: string[] = [];
	let isBodySection = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		if (i === 0 && line.trim()) {
			const requestLineParts = line.trim().split(/\s+/);
			if (requestLineParts.length >= 2) {
				method = requestLineParts[0] || "GET";
				path = requestLineParts.slice(1).join(" ");
			}
			continue;
		}

		if (line.trim() === "" && !isBodySection) {
			isBodySection = true;
			continue;
		}

		if (isBodySection) {
			bodyLines.push(line);
			continue;
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const headerName = line.substring(0, colonIndex).trim();
			const headerValue = line.substring(colonIndex + 1).trim();
			headers.push({
				id: crypto.randomUUID(),
				name: headerName,
				value: headerValue,
				enabled: true,
			});
		}
	}

	if (!headers.some((h) => h.name === "" && h.value === "")) {
		headers.push({
			id: crypto.randomUUID(),
			name: "",
			value: "",
			enabled: true,
		});
	}

	return {
		method,
		path,
		headers,
		body: bodyLines.join("\n").trim(),
	};
}

export function generateHttpRequest(tab: Tab): string {
	const requestLine = `${tab.method} ${tab.path || ""}`;

	const headers =
		tab.headers
			?.filter((header) => header.name && header.value && (header.enabled ?? true))
			.map((header) => `${header.name}: ${header.value}`)
			.join("\n") || "";

	const body = tab.body || "";

	return `${requestLine}\n${headers}\n\n${body}`;
}
