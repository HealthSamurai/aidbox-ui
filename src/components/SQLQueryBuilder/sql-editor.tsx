import type {
	Completion,
	CompletionContext,
	CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { psqlRequest } from "../db-console/tables-view";
import { useSQLQueryContext } from "./context";
import { type DependsOnSchema, useDependsOnSchemas } from "./resolve-schemas";
import { useResolvedParameterTree } from "./resolve-tree";

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

const TABLE_CONTEXT_REGEX = /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+[\w]*$/i;

function completeParameters(
	context: CompletionContext,
	paramNames: string[],
): CompletionResult | null {
	const colonMatch = context.matchBefore(/:[\w]*/);
	if (!colonMatch || paramNames.length === 0) return null;
	return {
		from: colonMatch.from + 1,
		options: paramNames.map((name) => ({
			label: name,
			type: "variable",
			detail: "parameter",
			boost: 99,
		})),
		validFor: /^[\w]*$/,
	};
}

function completeQualifiedColumns(
	context: CompletionContext,
	schemasByLabel: Map<string, DependsOnSchema>,
): CompletionResult | null {
	const qualifiedMatch = context.matchBefore(/[\w]+\.[\w]*/);
	if (!qualifiedMatch) return null;
	const dotIdx = qualifiedMatch.text.indexOf(".");
	const label = qualifiedMatch.text.slice(0, dotIdx);
	const schema = schemasByLabel.get(label);
	if (!schema || schema.columns.length === 0) return null;
	return {
		from: qualifiedMatch.from + dotIdx + 1,
		options: schema.columns.map((c) => ({
			label: c.name,
			type: "property",
			detail: c.type ?? "column",
			info: c.description ?? c.path,
			boost: 99,
		})),
		validFor: /^[\w]*$/,
	};
}

function completeTables(
	context: CompletionContext,
	dependsOnLabels: string[],
): CompletionResult | null {
	if (dependsOnLabels.length === 0) return null;
	const word = context.matchBefore(/[\w]*/);
	if (!word) return null;
	const line = context.state.doc.lineAt(context.pos);
	const textBefore = line.text.slice(0, context.pos - line.from);
	if (!TABLE_CONTEXT_REGEX.test(textBefore)) return null;
	return {
		from: word.from,
		options: dependsOnLabels.map((label) => ({
			label,
			type: "table",
			detail: "depends-on",
			boost: 99,
		})),
		validFor: /^[\w]*$/,
	};
}

function completeUnqualifiedColumns(
	context: CompletionContext,
	schemas: DependsOnSchema[],
): CompletionResult | null {
	if (schemas.length === 0) return null;
	const word = context.matchBefore(/[\w]*/);
	if (!word || word.from === word.to) return null;
	const options: Completion[] = [];
	const seen = new Set<string>();
	for (const s of schemas) {
		for (const c of s.columns) {
			const key = `${s.label}.${c.name}`;
			if (seen.has(key)) continue;
			seen.add(key);
			options.push({
				label: c.name,
				type: "property",
				detail: `${s.label}${c.type ? ` · ${c.type}` : ""}`,
				info: c.description ?? c.path,
				boost: 10,
			});
		}
	}
	if (options.length === 0) return null;
	return { from: word.from, options, validFor: /^[\w]*$/ };
}

export function SqlEditor() {
	const client = useAidboxClient();
	const { library, updateLibrary, triggerRunRef, runError } =
		useSQLQueryContext();
	const sql = React.useMemo(() => {
		const data = library.content?.[0]?.data;
		return data ? decodeBase64(data) : "";
	}, [library.content]);

	const handleChange = (value: string) => {
		if (value === sql) return;
		updateLibrary((lib) => {
			const existing = lib.content?.[0];
			const updated = {
				contentType: existing?.contentType ?? "application/sql",
				data: encodeBase64(value),
			};
			return { ...lib, content: [updated] };
		});
	};

	const sqlConfig = React.useMemo<HSComp.SqlConfig>(
		() => ({
			executeSql: async (query) => psqlRequest(client, query),
		}),
		[client],
	);

	const dependsOnLabels = React.useMemo(() => {
		const labels = new Set<string>();
		for (const ra of library.relatedArtifact ?? []) {
			if (ra.type === "depends-on" && ra.label) labels.add(ra.label);
		}
		return Array.from(labels);
	}, [library.relatedArtifact]);

	const { tree: resolvedParameterTree } = useResolvedParameterTree(library);
	const paramNames = React.useMemo(() => {
		const names = new Set<string>();
		for (const p of library.parameter ?? []) {
			if (p.name) names.add(p.name);
		}
		for (const p of resolvedParameterTree.inherited) {
			if (p.name) names.add(p.name);
		}
		return Array.from(names);
	}, [library.parameter, resolvedParameterTree.inherited]);

	const { schemas } = useDependsOnSchemas(library);
	const schemasByLabel = React.useMemo(() => {
		const map = new Map<string, (typeof schemas)[number]>();
		for (const s of schemas) map.set(s.label, s);
		return map;
	}, [schemas]);

	const additionalExtensions = React.useMemo(() => {
		const source = (context: CompletionContext): CompletionResult | null =>
			completeParameters(context, paramNames) ??
			completeQualifiedColumns(context, schemasByLabel) ??
			completeTables(context, dependsOnLabels) ??
			completeUnqualifiedColumns(context, schemas);
		return [
			EditorState.languageData.of(() => [{ autocomplete: source }]),
			Prec.highest(
				keymap.of([
					{
						key: "Mod-Enter",
						run: () => {
							triggerRunRef.current?.();
							return true;
						},
					},
				]),
			),
		];
	}, [dependsOnLabels, paramNames, schemas, schemasByLabel, triggerRunRef]);

	const issueLineNumbers = React.useMemo(() => {
		if (!runError) return undefined;
		const issue = runError.issue?.[0];
		const diagnostics = issue?.diagnostics;
		if (!diagnostics) return undefined;
		const posMatch = diagnostics.match(/Position:\s*(\d+)/);
		if (!posMatch?.[1]) return undefined;
		const position = Number.parseInt(posMatch[1], 10);
		if (!Number.isFinite(position) || position <= 0) return undefined;
		let line = 1;
		for (let i = 0; i < Math.min(position - 1, sql.length); i++) {
			if (sql[i] === "\n") line++;
		}
		const msgMatch = diagnostics.match(/ERROR:\s*(.+?)(?:\n|$)/);
		return [{ line, message: msgMatch?.[1] ?? diagnostics }];
	}, [runError, sql]);

	const lineCount = Math.max(1, sql.split("\n").length);
	const heightPx = Math.max(240, lineCount * 22 + 40);

	return (
		<div style={{ height: heightPx }} className="w-full">
			<HSComp.CodeEditor
				currentValue={sql}
				onChange={handleChange}
				mode="sql"
				sql={sqlConfig}
				additionalExtensions={additionalExtensions}
				issueLineNumbers={issueLineNumbers}
			/>
		</div>
	);
}
