import type {
	OperationOutcome,
	OperationOutcomeIssue,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { CodeEditorView } from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
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
	saveError?: OperationOutcome | null;
	onIssueClick?: (issue: OperationOutcomeIssue) => void;
	issueLineNumbers?: number[];
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
	saveError,
	onIssueClick,
	issueLineNumbers,
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
						/>
					</HSComp.ResizablePanel>
				</>
			)}
		</HSComp.ResizablePanelGroup>
	);
}
