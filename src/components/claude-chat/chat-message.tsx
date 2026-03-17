import type { ReactNode } from "react";
import type { ChatMessage } from "./types";

function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
	let last = 0;

	for (const match of text.matchAll(re)) {
		if (match.index > last) {
			nodes.push(text.slice(last, match.index));
		}
		const m = match[0];
		if (m.startsWith("`")) {
			nodes.push(
				<code
					key={match.index}
					className="px-1 py-0.5 rounded bg-black/10 text-[0.85em] font-mono break-all"
				>
					{m.slice(1, -1)}
				</code>,
			);
		} else if (m.startsWith("**")) {
			nodes.push(<strong key={match.index}>{m.slice(2, -2)}</strong>);
		} else {
			nodes.push(<em key={match.index}>{m.slice(1, -1)}</em>);
		}
		last = match.index + m.length;
	}
	if (last < text.length) {
		nodes.push(text.slice(last));
	}
	return nodes;
}

function MarkdownContent({ content }: { content: string }) {
	const blocks: ReactNode[] = [];
	const lines = content.split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Code block
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip closing ```
			blocks.push(
				<pre
					key={`b${String(blocks.length)}`}
					className="my-1.5 p-2 rounded bg-black/10 overflow-x-auto max-w-full text-[0.85em] font-mono"
				>
					<code data-lang={lang || undefined}>{codeLines.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		// Heading
		const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			const cls =
				level === 1
					? "text-base font-bold mt-2 mb-1"
					: level === 2
						? "text-sm font-bold mt-1.5 mb-0.5"
						: "text-sm font-semibold mt-1 mb-0.5";
			blocks.push(
				<div key={`b${String(blocks.length)}`} className={cls}>
					{renderInline(headingMatch[2])}
				</div>,
			);
			i++;
			continue;
		}

		// List item
		if (/^[-*]\s+/.test(line)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
				items.push(
					<li key={`li${String(items.length)}`}>
						{renderInline(lines[i].replace(/^[-*]\s+/, ""))}
					</li>,
				);
				i++;
			}
			blocks.push(
				<ul key={`b${String(blocks.length)}`} className="my-1 ml-4 list-disc">
					{items}
				</ul>,
			);
			continue;
		}

		// Numbered list
		if (/^\d+\.\s+/.test(line)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
				items.push(
					<li key={`li${String(items.length)}`}>
						{renderInline(lines[i].replace(/^\d+\.\s+/, ""))}
					</li>,
				);
				i++;
			}
			blocks.push(
				<ol
					key={`b${String(blocks.length)}`}
					className="my-1 ml-4 list-decimal"
				>
					{items}
				</ol>,
			);
			continue;
		}

		// Empty line
		if (line.trim() === "") {
			i++;
			continue;
		}

		// Paragraph
		blocks.push(
			<p key={`b${String(blocks.length)}`} className="my-2">
				{renderInline(line)}
			</p>,
		);
		i++;
	}

	return <>{blocks}</>;
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";

	return (
		<div className="min-w-0">
			<div
				className={`min-w-0 rounded-lg px-3 py-2 text-sm ${
					isUser
						? "bg-blue-600 text-white"
						: "bg-bg-secondary text-text-primary"
				}`}
			>
				{message.elementContexts && message.elementContexts.length > 0 && (
					<div className="mb-1.5 text-xs opacity-75 border-b border-current/20 pb-1.5">
						{message.elementContexts.map((ctx, i) => (
							<div key={`${ctx.selector}-${String(i)}`}>
								Element: &lt;{ctx.tagName}&gt;
								{ctx.componentName !== "unknown" && ` (${ctx.componentName})`}
							</div>
						))}
					</div>
				)}
				{message.toolName && (
					<div className="mb-1 text-xs opacity-60 italic">
						Using: {message.toolName}
					</div>
				)}
				<div className="break-words [overflow-wrap:anywhere]">
					{isUser ? (
						<span className="whitespace-pre-wrap">{message.content}</span>
					) : (
						<MarkdownContent content={message.content} />
					)}
					{message.isStreaming && (
						<span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current animate-pulse" />
					)}
				</div>
			</div>
		</div>
	);
}
