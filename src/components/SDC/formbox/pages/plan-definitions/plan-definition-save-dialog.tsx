import type { PlanDefinition } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@health-samurai/react-components";

/** Match Form Builder's warning and offer a new resource when its canonical changes. */
export function PlanDefinitionSaveDialog({
	planDefinition,
	savedPlanDefinition,
	isSaving,
	onSave,
	onCreate,
	onOpenChange,
}: {
	planDefinition: PlanDefinition | null;
	savedPlanDefinition: PlanDefinition | undefined;
	isSaving: boolean;
	onSave: () => void;
	onCreate: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	if (!planDefinition || !savedPlanDefinition) return null;
	const changedCanonical =
		planDefinition.url !== savedPlanDefinition.url ||
		planDefinition.version !== savedPlanDefinition.version;
	return (
		<Dialog open onOpenChange={(open) => !isSaving && onOpenChange(open)}>
			<DialogContent
				data-test-id="plan-definition-save-dialog"
				showCloseButton={false}
			>
				<DialogHeader>
					<DialogTitle>Save changes to an active package?</DialogTitle>
					<DialogDescription>
						{changedCanonical
							? "The version or canonical URL of this active package has changed. Create a new package to keep the existing version unchanged."
							: "This package is active. To preserve the current version, create a new package with a different version or canonical URL."}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="secondary"
						danger
						className="sm:mr-auto"
						disabled={isSaving}
						data-test-id="plan-definition-save-dialog__force-save-button"
						onClick={onSave}
					>
						Force Save
					</Button>
					{changedCanonical ? (
						<Button
							disabled={isSaving}
							data-test-id="plan-definition-save-dialog__create-button"
							onClick={onCreate}
						>
							Create New
						</Button>
					) : (
						<Button
							disabled={isSaving}
							data-test-id="plan-definition-save-dialog__close-button"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
