export function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}
