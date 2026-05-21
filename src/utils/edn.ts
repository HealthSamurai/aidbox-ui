type EdnNode =
	| { kind: "atom"; text: string }
	| { kind: "map"; items: [EdnNode, EdnNode][] }
	| { kind: "vec"; items: EdnNode[] }
	| { kind: "list"; items: EdnNode[] }
	| { kind: "set"; items: EdnNode[] }
	| { kind: "tagged"; tag: string; val: EdnNode };

type EdnTok =
	| { k: "open"; bracket: "{" | "[" | "(" | "#{" }
	| { k: "close"; bracket: "}" | "]" | ")" }
	| { k: "atom"; text: string }
	| { k: "tag"; name: string };

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: EDN tokenizer kept inline for clarity
function tokenizeEdn(src: string): EdnTok[] {
	const toks: EdnTok[] = [];
	const breakers = /[\s,{}[\]()";]/;
	let i = 0;
	while (i < src.length) {
		const c = src[i] as string;
		if (/[\s,]/.test(c)) {
			i++;
			continue;
		}
		if (c === ";") {
			const nl = src.indexOf("\n", i);
			i = nl < 0 ? src.length : nl + 1;
			continue;
		}
		if (c === "{" || c === "[" || c === "(") {
			toks.push({ k: "open", bracket: c });
			i++;
			continue;
		}
		if (c === "}" || c === "]" || c === ")") {
			toks.push({ k: "close", bracket: c });
			i++;
			continue;
		}
		if (c === '"') {
			let j = i + 1;
			while (j < src.length) {
				if (src[j] === "\\") {
					j += 2;
					continue;
				}
				if (src[j] === '"') {
					j++;
					break;
				}
				j++;
			}
			toks.push({ k: "atom", text: src.slice(i, j) });
			i = j;
			continue;
		}
		if (c === "#") {
			if (src[i + 1] === "{") {
				toks.push({ k: "open", bracket: "#{" });
				i += 2;
				continue;
			}
			let j = i + 1;
			while (j < src.length && !breakers.test(src[j] as string)) j++;
			toks.push({ k: "tag", name: src.slice(i + 1, j) });
			i = j;
			continue;
		}
		let j = i;
		while (j < src.length && !breakers.test(src[j] as string)) j++;
		toks.push({ k: "atom", text: src.slice(i, j) });
		i = j;
	}
	return toks;
}

function parseEdn(src: string): EdnNode {
	const toks = tokenizeEdn(src);
	let pos = 0;
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive descent EDN parser
	const readVal = (): EdnNode => {
		const t = toks[pos++];
		if (!t) throw new Error("unexpected EOF");
		if (t.k === "tag") return { kind: "tagged", tag: t.name, val: readVal() };
		if (t.k === "atom") return { kind: "atom", text: t.text };
		if (t.k === "open") {
			const closer =
				t.bracket === "{" || t.bracket === "#{"
					? "}"
					: t.bracket === "["
						? "]"
						: ")";
			const items: EdnNode[] = [];
			while (pos < toks.length) {
				const next = toks[pos] as EdnTok;
				if (next.k === "close" && next.bracket === closer) {
					pos++;
					break;
				}
				items.push(readVal());
			}
			if (t.bracket === "{") {
				const pairs: [EdnNode, EdnNode][] = [];
				for (let k = 0; k + 1 < items.length; k += 2)
					pairs.push([items[k] as EdnNode, items[k + 1] as EdnNode]);
				return { kind: "map", items: pairs };
			}
			if (t.bracket === "#{") return { kind: "set", items };
			if (t.bracket === "[") return { kind: "vec", items };
			return { kind: "list", items };
		}
		throw new Error(`unexpected token ${t.k}`);
	};
	return readVal();
}

const EDN_WIDTH = 72;

function ednCompact(n: EdnNode): string {
	switch (n.kind) {
		case "atom":
			return n.text;
		case "map":
			return `{${n.items.map(([k, v]) => `${ednCompact(k)} ${ednCompact(v)}`).join(", ")}}`;
		case "vec":
			return `[${n.items.map(ednCompact).join(" ")}]`;
		case "list":
			return `(${n.items.map(ednCompact).join(" ")})`;
		case "set":
			return `#{${n.items.map(ednCompact).join(" ")}}`;
		case "tagged":
			return `#${n.tag} ${ednCompact(n.val)}`;
	}
}

function ednFormat(n: EdnNode, col: number): string {
	const c = ednCompact(n);
	if (col + c.length <= EDN_WIDTH) return c;
	switch (n.kind) {
		case "atom":
			return n.text;
		case "map": {
			const inner = col + 1;
			const pairs = n.items.map(([k, v]) => {
				const ks = ednFormat(k, inner);
				const lastKLine = ks.split("\n").pop() ?? "";
				const vCol = inner + lastKLine.length + 1;
				const vs = ednFormat(v, vCol);
				return `${ks} ${vs}`;
			});
			return `{${pairs.join(`,\n${" ".repeat(inner)}`)}}`;
		}
		case "vec":
		case "list":
		case "set": {
			const open = n.kind === "vec" ? "[" : n.kind === "list" ? "(" : "#{";
			const close = n.kind === "vec" ? "]" : n.kind === "list" ? ")" : "}";
			const inner = col + open.length;
			const items = n.items.map((it) => ednFormat(it, inner));
			return `${open}${items.join(`\n${" ".repeat(inner)}`)}${close}`;
		}
		case "tagged": {
			const head = `#${n.tag} `;
			return head + ednFormat(n.val, col + head.length);
		}
	}
}

export function prettyEdn(src: string): string {
	return ednFormat(parseEdn(src), 0);
}
