export function ChartIconBar() {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<rect x="1.5" y="8" width="3" height="6.5" />
			<rect x="1.5" y="4.5" width="3" height="3" opacity="0.45" />
			<rect x="6.5" y="6" width="3" height="8.5" />
			<rect x="6.5" y="2.5" width="3" height="3" opacity="0.45" />
			<rect x="11.5" y="9.5" width="3" height="5" />
			<rect x="11.5" y="6" width="3" height="3" opacity="0.45" />
		</svg>
	);
}

export function ChartIconPyramid() {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<rect x="3" y="1.5" width="4.4" height="2.4" />
			<rect x="8.6" y="1.5" width="3.4" height="2.4" opacity="0.45" />
			<rect x="1.8" y="4.7" width="5.6" height="2.4" />
			<rect x="8.6" y="4.7" width="5" height="2.4" opacity="0.45" />
			<rect x="3.6" y="7.9" width="3.8" height="2.4" />
			<rect x="8.6" y="7.9" width="3" height="2.4" opacity="0.45" />
			<rect x="4.8" y="11.1" width="2.6" height="2.4" />
			<rect x="8.6" y="11.1" width="2" height="2.4" opacity="0.45" />
		</svg>
	);
}

export function ChartIconLine() {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polyline points="1.5,11 5,6.5 8.5,9 14.5,3" />
			<circle cx="5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
			<circle cx="8.5" cy="9" r="0.6" fill="currentColor" stroke="none" />
		</svg>
	);
}

export function ChartIconPie() {
	return (
		<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<circle cx="8" cy="8" r="6" opacity="0.4" />
			<path d="M8 8 L8 2 A6 6 0 0 1 13.2 11 Z" />
		</svg>
	);
}

export function ChartIconCustom() {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M6 2.5c-1.6 0-2.2 0.6-2.2 2.1v1.5c0 1-0.5 1.4-1.3 1.4 0.8 0 1.3 0.4 1.3 1.4v1.5c0 1.5 0.6 2.1 2.2 2.1" />
			<path d="M10 2.5c1.6 0 2.2 0.6 2.2 2.1v1.5c0 1 0.5 1.4 1.3 1.4-0.8 0-1.3 0.4-1.3 1.4v1.5c0 1.5-0.6 2.1-2.2 2.1" />
		</svg>
	);
}
