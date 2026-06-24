import type { ReactNode } from "react";
import { format as formatSQL } from "sql-formatter";

export const EM_DASH = <span className="text-text-tertiary">—</span>;

export function formatRows(n: number): ReactNode {
	if (n == null || n < 0) return EM_DASH;
	const v = Math.round(n);
	if (v < 1000) return String(v);
	if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
	if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	return `${(v / 1_000_000_000).toFixed(1)}B`;
}

export function formatMinAgo(min: number | null): ReactNode {
	if (min == null) return EM_DASH;
	if (min < 60) return `${min}m ago`;
	if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`;
	return `${Math.floor(min / (24 * 60))}d ago`;
}

export function tryFormatSql(sql: string): string {
	try {
		const formatted = formatSQL(sql, {
			language: "postgresql",
			expressionWidth: 80,
		});
		return formatted.replace(
			/^(CREATE(?:\s+UNIQUE)?\s+INDEX\s+\S+)\s+ON\s+(\S+)\s+USING\s+/im,
			"$1\n  ON $2\n  USING ",
		);
	} catch {
		return sql;
	}
}
