import { getCookie } from "./cookie";

export function getPathPrefix(): string {
	const raw = getCookie("aidbox-base-url");
	if (!raw) return "";
	try {
		return new URL(raw).pathname.replace(/\/+$/, "");
	} catch {
		return "";
	}
}
