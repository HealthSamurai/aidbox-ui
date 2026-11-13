import { useEffect, useRef } from "react";
import type { Msg } from "./use-conversation";

export function parseTranscript(text: string): Msg[] {
	const lines = text.split(/\r?\n/);
	const messages: Msg[] = [];
	for (const line of lines) {
		const match = line.match(/^(Agent|Person(?:\s+\[P\d+\])?):\s*(.*)$/);
		if (match?.[1] != null) {
			messages.push({
				id: String(messages.length),
				role: match[1].startsWith("Person") ? "user" : "assistant",
				content: match[2] ?? "",
			});
			continue;
		}
		const last = messages.at(-1);
		if (last && line.trim()) last.content += `\n${line}`;
	}
	return messages;
}

/**
 * What the agent and the person actually said. Announced to assistive tech as
 * it arrives, and pinned to the newest line: a transcript that scrolls out of
 * sight during a live call is no transcript at all.
 */
export function Transcript({
	messages,
	empty = "Nothing said yet.",
}: {
	messages: Msg[];
	empty?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = ref.current;
		if (node && messages.length) node.scrollTop = node.scrollHeight;
	}, [messages.length]);

	return (
		<div
			ref={ref}
			role="log"
			aria-live="polite"
			aria-label="Transcript"
			data-test-id="transcript"
			className="flex h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-border-primary bg-bg-secondary p-4"
		>
			{messages.length === 0 ? (
				<p
					className="m-auto text-text-tertiary typo-body"
					data-test-id="transcript__empty-text"
				>
					{empty}
				</p>
			) : (
				messages.map((m) => {
					const patient = m.role !== "assistant";
					return (
						<div
							key={m.id}
							data-test-id="transcript__message"
							data-role={m.role}
							className={`flex max-w-[82%] flex-col gap-0.5 rounded-2xl px-3 py-2 ${
								patient
									? "self-end rounded-br-sm bg-bg-link text-text-primary_on-brand"
									: "self-start rounded-bl-sm border border-border-primary bg-bg-primary"
							}`}
						>
							<span
								data-test-id="transcript__message-role-text"
								className={`typo-label ${
									patient
										? "text-text-primary_on-brand/70"
										: "text-text-tertiary"
								}`}
							>
								{patient ? "Patient" : "Agent"}
							</span>
							<p
								className="whitespace-pre-wrap typo-body"
								data-test-id="transcript__message-text"
							>
								{m.content}
							</p>
						</div>
					);
				})
			)}
		</div>
	);
}
