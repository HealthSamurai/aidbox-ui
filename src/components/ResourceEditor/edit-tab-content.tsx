import type {
	OperationOutcome,
	OperationOutcomeIssue,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { CodeEditorView } from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { useGetStructureDefinition } from "../../hooks/useGetStructureDefinition";
import type { ResourceEditorActions } from "../../webmcp/resource-editor-context";
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
	saveError?: OperationOutcome | null;
	onIssueClick?: (issue: OperationOutcomeIssue) => void;
	issueLineNumbers?: { line: number; message?: string }[];
	resourceType: string;
	storageKey: string;
	autoSaveId: string;
	actionsRef?: React.RefObject<ResourceEditorActions>;
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
	saveError,
	onIssueClick,
	issueLineNumbers,
	resourceType,
	storageKey,
	autoSaveId,
	actionsRef,
}: EditTabContentProps) {
	const getStructureDefinition = useGetStructureDefinition();

	const [isProfileOpen, setIsProfileOpen] = useLocalStorage<boolean>({
		key: storageKey,
		defaultValue: false,
		getInitialValueInEffect: false,
	});

	const handleToggleProfile = () => {
		setIsProfileOpen((prev) => !prev);
	};

	if (actionsRef) {
		actionsRef.current.editorToggleProfilePanel = () => {
			setIsProfileOpen((prev) => !prev);
		};
		actionsRef.current.editorGetProfile = () => ({ open: isProfileOpen });
	}

	React.useEffect(() => {
		if (!isProfileOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsProfileOpen(false);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isProfileOpen, setIsProfileOpen]);

	return (
		<HSComp.ResizablePanelGroup direction="horizontal" autoSaveId={autoSaveId}>
			<HSComp.ResizablePanel minSize={20}>
				<HSComp.ResizablePanelGroup direction="vertical">
					<HSComp.ResizablePanel>
						<EditorTab
							mode={mode}
							setMode={setMode}
							triggerFormat={triggerFormat}
							resourceText={resourceText}
							defaultResourceText={defaultResourceText}
							setResourceText={setResourceText}
							viewCallback={viewCallback}
							actions={actions}
							issueLineNumbers={issueLineNumbers}
							getStructureDefinition={getStructureDefinition}
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
					{saveError && (
						<>
							<HSComp.ResizableHandle />
							<HSComp.ResizablePanel defaultSize={30} minSize={10}>
								<HSComp.OperationOutcomeView
									resource={saveError}
									onIssueClick={onIssueClick}
									className="h-full overflow-auto"
								/>
							</HSComp.ResizablePanel>
						</>
					)}
				</HSComp.ResizablePanelGroup>
			</HSComp.ResizablePanel>
			{isProfileOpen && (
				<>
					<HSComp.ResizableHandle />
					<HSComp.ResizablePanel minSize={20}>
						<ProfilePanel
							resourceType={resourceType}
							onClose={handleToggleProfile}
							actionsRef={actionsRef}
							onOpenPanel={() => setIsProfileOpen(true)}
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
}
