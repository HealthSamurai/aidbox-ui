import type * as React from "react";

export type MatchRange = readonly [number, number];

export function highlight(
	text: string,
	ranges: readonly MatchRange[] | undefined,
): React.ReactNode {
	if (!ranges || ranges.length === 0) return text;
	const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	sorted.forEach(([start, end]) => {
		if (start < cursor) return;
		if (start > cursor) parts.push(text.slice(cursor, start));
		parts.push(
			<span key={`${start}-${end}`} className="font-medium">
				{text.slice(start, end + 1)}
			</span>,
		);
		cursor = end + 1;
	});
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
}

export function filterHighlightRanges(
	needle: string,
	ranges: readonly MatchRange[] | undefined,
): readonly MatchRange[] | undefined {
	if (!ranges) return ranges;
	const min = Math.min(Math.max(needle.length, 1), 3);
	return ranges.filter(([s, e]) => e - s + 1 >= min);
}
