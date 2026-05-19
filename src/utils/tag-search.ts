export function tagSlug(text: string): string {
	return text.toLowerCase().replace(/&amp;/g, "&").replace(/\s+/g, "-");
}

export function parseQuery(q: string): { chips: string[]; text: string } {
	const tokens = q.split(/\s+/).filter(Boolean);
	const chips: string[] = [];
	const textTokens: string[] = [];
	for (const t of tokens) {
		if (t.startsWith("#") && t.length > 1) chips.push(t.slice(1));
		else textTokens.push(t);
	}
	return { chips, text: textTokens.join(" ") };
}

export function buildQuery(chips: string[], text: string): string {
	const chipStr = chips.map((c) => `#${c}`).join(" ");
	const trimmedText = text.trim();
	if (chipStr && trimmedText) return `${chipStr} ${trimmedText}`;
	return chipStr || trimmedText;
}
