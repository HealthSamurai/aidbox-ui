export function getAidboxBaseURL(): string {
	const vite_base_url = import.meta.env.VITE_AIDBOX_BASE_URL;
	if (vite_base_url) {
		return vite_base_url;
	}
	return `${window.location.protocol}//${window.location.host}`;
}
