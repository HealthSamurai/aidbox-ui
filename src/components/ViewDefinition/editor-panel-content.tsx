import { ResourceTypeSelect } from "./resource-type-select";

export const EditorHeaderMenu = () => {
	return (
		<div className="flex items-center gap-2 bg-bg-secondary px-4 py-3 border-b">
			<ResourceTypeSelect />
		</div>
	);
};

export const EditorPanelContent = () => {
	return (
		<div>
			<EditorHeaderMenu />
		</div>
	);
};
