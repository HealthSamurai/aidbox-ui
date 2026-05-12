import * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { useSQLQueryContext } from "./context";

function decodeBase64(b64: string): string {
	try {
		return atob(b64);
	} catch {
		return "";
	}
}

function encodeBase64(text: string): string {
	try {
		return btoa(text);
	} catch {
		return "";
	}
}

export function SqlEditor() {
	const { library, updateLibrary } = useSQLQueryContext();
	const sql = React.useMemo(() => {
		const data = library.content?.[0]?.data;
		return data ? decodeBase64(data) : "";
	}, [library.content]);

	const handleChange = (value: string) => {
		updateLibrary((lib) => {
			const existing = lib.content?.[0];
			const updated = {
				contentType: existing?.contentType ?? "application/sql",
				data: encodeBase64(value),
			};
			return { ...lib, content: [updated] };
		});
	};

	return (
		<HSComp.CodeEditor currentValue={sql} onChange={handleChange} mode="sql" />
	);
}
