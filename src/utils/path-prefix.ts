// Everything before the first /u segment of the browser URL. Not taken from
// BOX_WEB_BASE_URL: a gateway may add a prefix Aidbox doesn't know about.
// Keep in sync with the inline <base> script in vite.config.ts.
export function getPathPrefix(): string {
	const path = `${window.location.pathname}/`;
	const i = path.indexOf("/u/");
	return i === -1 ? "" : path.slice(0, i);
}
