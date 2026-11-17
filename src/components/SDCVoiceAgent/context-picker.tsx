import { Combobox, Label } from "@health-samurai/react-components";
import { useId } from "react";
import { useContextCandidates, type VoiceAgentContextSlot } from "./api";

/**
 * Picks the resource that fills one declared context slot. $call refuses a call
 * whose declared slots are not all supplied, so this is what stands between the
 * agent and a half-blind conversation.
 */

export type ContextCandidate = { id?: string } & Record<string, unknown>;

/** A one-line name for a resource of any type — enough to tell rows apart. */
function candidateLabel(candidate: ContextCandidate) {
	const name = candidate.name;
	if (Array.isArray(name) && name[0]) {
		const first = name[0] as { given?: string[]; family?: string };
		const given = first.given?.join(" ") ?? "";
		const full = [given, first.family].filter(Boolean).join(" ");
		if (full) return full;
	}
	if (typeof name === "string") return name;
	if (typeof candidate.title === "string") return candidate.title;
	// the shape is whatever the resource type happens to carry, so anything
	// that is not a string has to be coerced before it reaches the combobox
	return typeof candidate.id === "string" ? candidate.id : "";
}

export function ContextPicker({
	slot,
	value,
	onChange,
}: {
	slot: VoiceAgentContextSlot;
	value?: string;
	onChange: (id: string, resource?: ContextCandidate) => void;
}) {
	const fieldId = useId();
	const candidates = useContextCandidates(slot.type);

	const resources = (candidates.data ?? []) as ContextCandidate[];
	const options = resources.map((candidate) => ({
		value: candidate.id ?? "",
		label: candidateLabel(candidate),
	}));

	const emptyText = candidates.isError
		? `Could not load ${slot.type}.`
		: `No ${slot.type} found.`;

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={fieldId}>
				{slot.label ?? slot.name}
				<span className="ml-1 text-text-tertiary typo-label">{slot.type}</span>
			</Label>
			<Combobox
				className="bg-bg-primary"
				data-test-id="context-picker__resource-dropdown"
				data-slot-name={slot.name}
				disabled={candidates.isPending || candidates.isError}
				emptyText={emptyText}
				options={options}
				placeholder={
					candidates.isPending ? "Loading…" : `Choose a ${slot.type}…`
				}
				searchPlaceholder="Search…"
				value={value ?? ""}
				onValueChange={(id) =>
					onChange(
						id,
						resources.find((candidate) => candidate.id === id),
					)
				}
			/>
		</div>
	);
}
