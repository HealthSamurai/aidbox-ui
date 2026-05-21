export function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

type CookieStore = {
	set: (options: {
		name: string;
		value: string;
		path?: string;
		expires?: number;
	}) => Promise<void>;
};

export function setCookie(
	name: string,
	value: string,
	options: { path?: string; maxAgeSeconds?: number } = {},
): void {
	const path = options.path ?? "/";
	const maxAge = options.maxAgeSeconds;
	const store = (globalThis as { cookieStore?: CookieStore }).cookieStore;
	if (store) {
		store.set({
			name,
			value,
			path,
			expires: maxAge !== undefined ? Date.now() + maxAge * 1000 : undefined,
		});
		return;
	}
	const parts = [`${name}=${encodeURIComponent(value)}`, `path=${path}`];
	if (maxAge !== undefined) parts.push(`max-age=${maxAge}`);
	const cookieKey = "cookie";
	(document as unknown as Record<string, string>)[cookieKey] = parts.join("; ");
}
