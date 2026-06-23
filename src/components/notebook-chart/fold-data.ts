import {
	codeFolding,
	ensureSyntaxTree,
	foldEffect,
	syntaxTree,
} from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

export const chartConfigExtensions = [codeFolding()];

function findDataValueRange(
	view: EditorView,
): { from: number; to: number } | null {
	const { state } = view;
	const tree =
		ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);
	const obj = tree.topNode.firstChild;
	if (!obj || obj.name !== "Object") return null;
	for (let prop = obj.firstChild; prop; prop = prop.nextSibling) {
		if (prop.name !== "Property") continue;
		const nameNode = prop.getChild("PropertyName");
		if (!nameNode) continue;
		if (state.sliceDoc(nameNode.from, nameNode.to) !== '"data"') continue;
		const value = prop.lastChild;
		if (value && value.name !== "PropertyName" && value.to - value.from > 2) {
			return { from: value.from + 1, to: value.to - 1 };
		}
	}
	return null;
}

export function foldChartConfigData(view: EditorView): void {
	requestAnimationFrame(() => {
		const range = findDataValueRange(view);
		if (range) {
			view.dispatch({ effects: foldEffect.of(range) });
		}
	});
}
