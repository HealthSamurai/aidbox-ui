import * as HSComp from "@health-samurai/react-components";
import type { CodeEditorView } from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import { useLocalStorage } from "../../hooks";
import { EditorTab } from "./editor-tab";
import { ProfilePanel } from "./profile-panel";

interface EditTabContentProps {
	mode: "json" | "yaml";
	setMode: (mode: "json" | "yaml") => void;
	triggerFormat: () => void;
	resourceText: string;
	defaultResourceText: string;
	setResourceText: (text: string) => void;
	viewCallback?: (view: CodeEditorView) => void;
	actions?: React.ReactNode;
	resourceType: string;
	storageKey: string;
	autoSaveId: string;
}

export function EditTabContent({
	mode,
	setMode,
	triggerFormat,
	resourceText,
	defaultResourceText,
	setResourceText,
	viewCallback,
	actions,
	resourceType,
	storageKey,
	autoSaveId,
}: EditTabContentProps) {
	const [isProfileOpen, setIsProfileOpen] = useLocalStorage<boolean>({
		key: storageKey,
		defaultValue: false,
		getInitialValueInEffect: false,
	});

	const handleToggleProfile = () => {
		setIsProfileOpen((prev) => !prev);
	};

	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId={autoSaveId}
		>
			<HSComp.ResizablePanel minSize={20}>
				<EditorTab
					mode={mode}
					setMode={setMode}
					triggerFormat={triggerFormat}
					resourceText={resourceText}
					defaultResourceText={defaultResourceText}
					setResourceText={setResourceText}
					viewCallback={viewCallback}
					actions={actions}
					trailingActions={
						<>
							<HSComp.Separator orientation="vertical" className="h-6!" />
							<HSComp.Toggle
								variant="outline"
								pressed={isProfileOpen}
								onPressedChange={handleToggleProfile}
							>
								<Lucide.PanelRightIcon className="w-4 h-4" />
								Profile
							</HSComp.Toggle>
						</>
					}
				/>
			</HSComp.ResizablePanel>
			{isProfileOpen && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel minSize={20}>
						<ProfilePanel
							resourceType={resourceType}
							onClose={handleToggleProfile}
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
}
