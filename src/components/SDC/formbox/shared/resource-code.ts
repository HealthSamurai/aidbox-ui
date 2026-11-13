import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useState } from "react";
import { z } from "zod";
import { errorOutcome, ResourceRequestError } from "../api/resource-error";
import {
	convertResourceText,
	parseResourceText,
	type ResourceFormat,
	serializeResource,
} from "./resource-format";

export type EditableResource = {
	resourceType: string;
	id?: string;
	meta?: { versionId?: string; lastUpdated?: string };
};

export function parseResourceCode<T extends EditableResource>(
	text: string,
	current: T,
	validate: (value: unknown) => void,
	format: ResourceFormat = "json",
): T {
	const value = parseResourceText(text, format);
	const result = z
		.object({
			resourceType: z.literal(current.resourceType),
			id: z.string().optional(),
		})
		.passthrough()
		.safeParse(value);
	if (!result.success)
		throw new Error(
			`Enter a ${current.resourceType} ${format.toUpperCase()} object`,
		);
	if (result.data.id !== current.id)
		throw new Error("The resource ID cannot be changed in this editor");
	validate(value);
	// Metadata belongs to the current saved revision, not the edited text.
	return { ...(value as T), meta: current.meta };
}

export function validateResourceShape(schema: z.ZodType, value: unknown) {
	const result = schema.safeParse(value);
	if (!result.success)
		throw new ResourceRequestError(
			{
				resourceType: "OperationOutcome",
				issue: result.error.issues.map((issue) => ({
					severity: "error",
					code: "structure",
					diagnostics: issue.message,
					expression: [issue.path.join(".")],
				})),
			},
			0,
		);
}

/** Text stays independent while editing: invalid code never replaces a valid draft. */
export function useResourceCode<T extends EditableResource>({
	getResource,
	onApply,
	validate,
}: {
	getResource: () => T;
	onApply: (resource: T) => void;
	validate: (value: unknown) => void;
}) {
	const [mode, setMode] = useState("form");
	const [language, setLanguage] = useState<ResourceFormat>("json");
	const [text, setText] = useState("");
	const [baseline, setBaseline] = useState("");
	const [error, setError] = useState<unknown>(null);
	const [focusIssue, setFocusIssue] = useState<OperationOutcomeIssue | null>(
		null,
	);
	const dirty = mode === "code" && text !== baseline;

	const reset = (next: T, preserveError = false) => {
		const serialized = serializeResource(next, language);
		setText(serialized);
		setBaseline(serialized);
		if (!preserveError) setError(null);
		setFocusIssue(null);
	};
	const read = (): T | null => {
		try {
			const resource = getResource();
			// An unchanged serialization must not erase incomplete visual form fields.
			const next = dirty
				? parseResourceCode(text, resource, validate, language)
				: resource;
			setError(null);
			return next;
		} catch (error) {
			setError(error);
			return null;
		}
	};
	const changeMode = (next: string) => {
		if (next === mode) return;
		if (next === "form") {
			const value = read();
			if (!value) return;
			if (dirty) onApply(value);
		} else {
			try {
				reset(getResource(), true);
			} catch (error) {
				setError(error);
				return;
			}
		}
		setMode(next);
	};
	const format = () => {
		try {
			setText(serializeResource(parseResourceText(text, language), language));
			setError(null);
		} catch {
			setError(
				errorOutcome(`Fix invalid ${language.toUpperCase()} before formatting`),
			);
		}
	};
	const changeLanguage = (next: ResourceFormat) => {
		if (next === language) return;
		try {
			const converted = convertResourceText(text, language, next);
			const convertedBaseline = convertResourceText(baseline, language, next);
			setText(converted);
			setBaseline(convertedBaseline);
			setLanguage(next);
			setError(null);
		} catch {
			setError(
				errorOutcome(
					`Fix invalid ${language.toUpperCase()} before switching to ${next.toUpperCase()}`,
				),
			);
		}
	};
	const revealIssue = (issue: OperationOutcomeIssue) => {
		changeMode("code");
		setFocusIssue({ ...issue });
	};
	return {
		mode,
		language,
		changeLanguage,
		text,
		setText,
		dirty,
		error,
		setError,
		read,
		reset,
		changeMode,
		format,
		formatShortcut: mode === "code" ? format : undefined,
		focusIssue,
		revealIssue,
	};
}
