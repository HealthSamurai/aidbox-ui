import * as HSComp from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import React from "react";
import { useDebounce } from "../../hooks";

type EditorMode = "json" | "yaml";

interface ResourceEditorPageProps {
	id?: string;
}

interface ResourceData {
	resourceType?: string;
	id?: string;
	[key: string]: unknown;
}

const CodeEditorMenubar = ({
	mode,
	onModeChange,
	onFormat,
	onSave,
	onCopy,
}: {
	mode: EditorMode;
	onModeChange: (mode: EditorMode) => void;
	onFormat: () => void;
	onSave?: () => void;
	onCopy: () => void;
}) => {
	return (
		<div className="flex items-center gap-2 bg-background-secondary p-2 rounded-md shadow-sm">
			<div className="flex items-center gap-1">
				<button
					type="button"
					className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
						mode === "json" ? "bg-primary text-white" : "bg-background hover:bg-background-tertiary text-text-primary"
					}`}
					onClick={() => onModeChange("json")}
				>
					JSON
				</button>
				<button
					type="button"
					className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
						mode === "yaml" ? "bg-primary text-white" : "bg-background hover:bg-background-tertiary text-text-primary"
					}`}
					onClick={() => onModeChange("yaml")}
				>
					YAML
				</button>
			</div>
			<div className="h-4 w-px bg-border" />
			<button
				type="button"
				className="px-3 py-1 rounded text-sm font-medium bg-background hover:bg-background-tertiary text-text-primary transition-colors"
				onClick={onFormat}
			>
				Format
			</button>
			<button
				type="button"
				className="px-3 py-1 rounded text-sm font-medium bg-background hover:bg-background-tertiary text-text-primary transition-colors"
				onClick={onCopy}
			>
				Copy
			</button>
			{onSave && (
				<button
					type="button"
					className="px-3 py-1 rounded text-sm font-medium bg-success text-white hover:bg-success-dark transition-colors"
					onClick={onSave}
				>
					Save
				</button>
			)}
		</div>
	);
};

const ResourceCodeEditor = ({
	editorValue,
	mode,
	onChange,
	onResourceChange,
}: {
	editorValue: string;
	mode: EditorMode;
	onChange: (value: string) => void;
	onResourceChange?: (resource: ResourceData) => void;
}) => {
	const debouncedResourceChange = useDebounce((resource: ResourceData) => {
		onResourceChange?.(resource);
	}, 500);

	const handleEditorChange = (value: string) => {
		onChange(value);
		try {
			const parsedValue = mode === "json" ? JSON.parse(value) : yaml.load(value);
			debouncedResourceChange(parsedValue as ResourceData);
		} catch (_error) {
			// Invalid syntax, ignore
		}
	};

	return <HSComp.CodeEditor currentValue={editorValue} mode={mode} onChange={handleEditorChange} />;
};

export const ResourceEditorPage: React.FC<ResourceEditorPageProps> = ({ id }) => {
	const [mode, setMode] = React.useState<EditorMode>("json");
	const [editorValue, setEditorValue] = React.useState<string>("");
	const [resource, setResource] = React.useState<ResourceData | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);

	const stringifyResource = React.useCallback(
		(resourceData: ResourceData) => {
			if (mode === "yaml") {
				return yaml.dump(resourceData, { indent: 2 });
			}
			return JSON.stringify(resourceData, null, 2);
		},
		[mode],
	);

	React.useEffect(() => {
		if (id) {
			setIsLoading(true);
			// Simulate loading resource by id
			setTimeout(() => {
				const mockResource: ResourceData = {
					resourceType: "Patient",
					id: id,
					name: [
						{
							use: "official",
							family: "Smith",
							given: ["John", "Jacob"],
						},
					],
					gender: "male",
					birthDate: "1970-01-01",
					active: true,
				};
				setResource(mockResource);
				setEditorValue(stringifyResource(mockResource));
				setIsLoading(false);
			}, 1000);
		} else {
			// New resource
			const emptyResource: ResourceData = {
				resourceType: "Patient",
			};
			setResource(emptyResource);
			setEditorValue(stringifyResource(emptyResource));
		}
	}, [id, stringifyResource]);

	React.useEffect(() => {
		if (resource) {
			setEditorValue(stringifyResource(resource));
		}
	}, [resource, stringifyResource]);

	const handleFormat = () => {
		try {
			const parsed = mode === "yaml" ? yaml.load(editorValue) : JSON.parse(editorValue);
			const formatted = stringifyResource(parsed as ResourceData);
			setEditorValue(formatted);
			HSComp.toast.success("Code formatted", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		} catch {
			HSComp.toast.error("Invalid syntax - cannot format", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		}
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(editorValue);
		HSComp.toast.success("Copied to clipboard", {
			position: "bottom-right",
			style: { margin: "1rem" },
		});
	};

	const handleSave = async () => {
		try {
			setIsSaving(true);
			const parsed = mode === "json" ? JSON.parse(editorValue) : yaml.load(editorValue);

			// Simulate save API call
			await new Promise((resolve) => setTimeout(resolve, 1000));

			setResource(parsed as ResourceData);
			HSComp.toast.success(id ? "Resource updated successfully" : "Resource created successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		} catch {
			HSComp.toast.error("Failed to save resource", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading Resource...</div>
					<div className="text-sm">ID: {id}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-text-primary">Resource Editor</h1>
						{id && <p className="text-sm text-text-secondary mt-1">Editing resource: {id}</p>}
						{!id && <p className="text-sm text-text-secondary mt-1">Creating new resource</p>}
					</div>
					<div className="flex items-center gap-2">
						{resource?.resourceType && (
							<span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
								{resource.resourceType}
							</span>
						)}
					</div>
				</div>
			</div>

			<div className="flex-1 relative">
				<div className="absolute top-2 right-3 z-10">
					<CodeEditorMenubar
						mode={mode}
						onModeChange={setMode}
						onFormat={handleFormat}
						onCopy={handleCopy}
						onSave={handleSave}
					/>
				</div>

				<div className="h-full pt-14">
					<ResourceCodeEditor
						editorValue={editorValue}
						mode={mode}
						onChange={setEditorValue}
						onResourceChange={setResource}
					/>
				</div>
			</div>

			{isSaving && (
				<div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
					<div className="bg-background-secondary p-4 rounded-md shadow-lg">
						<div className="text-center">
							<div className="text-lg mb-2">Saving...</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
