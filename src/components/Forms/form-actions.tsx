import * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import {
	type Form as FormboxForm,
	type QuestionnaireDeleteCheck,
	useDeleteQuestionnaire,
	useDuplicateQuestionnaire,
	useQuestionnaireDeleteCheck,
} from "./api/forms";
import type { Form } from "./api/forms-list";
import { getFormLabel, getFormPinId } from "./api/forms-list";
import {
	useDeletePlanDefinition,
	useDuplicatePlanDefinition,
} from "./api/plan-definitions";
import { DeleteFormDialog } from "./delete-form-dialog";
import { FormPreviewDialog } from "./form-preview-dialog";
import { ImportFormDialog } from "./import/import-form-dialog";
import { GeneratedFormLinkDialog } from "./share/generated-form-link-dialog";
import { SendFormDialog } from "./share/send-form-dialog";
import { ShareFormDialog } from "./share/share-form-dialog";

/**
 * The grid reads a narrow view of each form; the actions, ported from Formbox,
 * take the whole R4 resource, which is what the search returned.
 */
export function toFormboxForm(form: Form): FormboxForm {
	return form as unknown as FormboxForm;
}

export type FormActions = {
	preview: (form: Form) => void;
	share: (form: Form) => void;
	send: (form: Form) => void;
	duplicate: (form: Form) => void;
	delete: (form: Form) => void;
	importForm: () => void;
};

/**
 * What can be done to a form from the grid, as in Formbox: preview, share a
 * link, send, duplicate, delete (after checking what still uses it), import.
 * Returns the handlers and the dialogs they open, to be rendered once.
 */
export function useFormActions({
	onDeleted,
}: {
	/** A form is gone: drop it from the pins and the selection. */
	onDeleted: (deleted: { pinId: string; key: string }) => void;
}): { actions: FormActions; dialogs: React.ReactNode } {
	const [formForDelete, setFormForDelete] = React.useState<FormboxForm | null>(
		null,
	);
	const [deleteCheck, setDeleteCheck] =
		React.useState<QuestionnaireDeleteCheck | null>(null);
	const [formForPreview, setFormForPreview] =
		React.useState<FormboxForm | null>(null);
	const [formForSend, setFormForSend] = React.useState<FormboxForm | null>(
		null,
	);
	const [formForShare, setFormForShare] = React.useState<FormboxForm | null>(
		null,
	);
	const [generatedLink, setGeneratedLink] = React.useState<string | null>(null);
	const [importOpen, setImportOpen] = React.useState(false);

	const deleteQuestionnaire = useDeleteQuestionnaire();
	const duplicateQuestionnaire = useDuplicateQuestionnaire();
	const deletePlanDefinition = useDeletePlanDefinition();
	const duplicatePlanDefinition = useDuplicatePlanDefinition();
	const deleteCheckMutation = useQuestionnaireDeleteCheck();
	const isDeleting =
		deleteQuestionnaire.isPending || deletePlanDefinition.isPending;

	const deleted = (form: FormboxForm) => {
		onDeleted({
			pinId: getFormPinId(form),
			key: `${form.resourceType}/${form.id}`,
		});
		HSComp.toast.success(`Deleted ${getFormLabel(form)}`);
	};
	const showError = (error: Error) => HSComp.toast.error(error.message);

	const duplicate = (form: FormboxForm) => {
		if (
			!form.id ||
			duplicateQuestionnaire.isPending ||
			duplicatePlanDefinition.isPending
		) {
			return;
		}
		const options = {
			onError: showError,
			onSuccess: () => HSComp.toast.success(`Duplicated ${getFormLabel(form)}`),
		};
		if (form.resourceType === "PlanDefinition")
			duplicatePlanDefinition.mutate(form.id, options);
		else duplicateQuestionnaire.mutate(form.id, options);
	};

	// A package is deleted after a plain confirmation; a Questionnaire first
	// asks the box what still refers to it, and deletes at once when nothing
	// does.
	const remove = (form: FormboxForm) => {
		if (!form.id || isDeleting || deleteCheckMutation.isPending) return;
		if (form.resourceType === "PlanDefinition") {
			setFormForDelete(form);
			return;
		}
		deleteCheckMutation.mutate(form, {
			onError: showError,
			onSuccess: (check) => {
				if (check.requiresConfirmation) {
					setFormForDelete(form);
					setDeleteCheck(check);
					return;
				}
				deleteQuestionnaire.mutate(form, {
					onError: showError,
					onSuccess: () => deleted(form),
				});
			},
		});
	};

	const closeDeleteDialog = () => {
		setDeleteCheck(null);
		setFormForDelete(null);
	};
	const confirmDelete = () => {
		if (!formForDelete || isDeleting) return;
		const form = formForDelete;
		const options = {
			onError: showError,
			onSuccess: () => {
				deleted(form);
				closeDeleteDialog();
			},
		};
		if (form.resourceType === "PlanDefinition")
			deletePlanDefinition.mutate(form, options);
		else deleteQuestionnaire.mutate(form, options);
	};

	const closeWhen =
		(close: () => void) =>
		(open: boolean): void => {
			if (!open) close();
		};

	const dialogs = (
		<>
			<ImportFormDialog open={importOpen} onOpenChange={setImportOpen} />
			<SendFormDialog
				form={formForSend}
				onOpenChange={closeWhen(() => setFormForSend(null))}
			/>
			<ShareFormDialog
				form={formForShare}
				onGenerateLink={setGeneratedLink}
				onOpenChange={closeWhen(() => setFormForShare(null))}
			/>
			<GeneratedFormLinkDialog
				link={generatedLink}
				onOpenChange={closeWhen(() => setGeneratedLink(null))}
			/>
			<FormPreviewDialog
				form={formForPreview}
				onOpenChange={closeWhen(() => setFormForPreview(null))}
			/>
			<DeleteFormDialog
				form={formForDelete}
				open={Boolean(formForDelete)}
				componentUsage={deleteCheck?.componentUsage ?? []}
				qrUsage={deleteCheck?.qrUsage ?? []}
				isDeleting={isDeleting}
				onConfirm={confirmDelete}
				onOpenChange={(open) => {
					if (!open && !isDeleting) closeDeleteDialog();
				}}
			/>
		</>
	);

	return {
		actions: {
			preview: (form) => setFormForPreview(toFormboxForm(form)),
			share: (form) => setFormForShare(toFormboxForm(form)),
			send: (form) => setFormForSend(toFormboxForm(form)),
			duplicate: (form) => duplicate(toFormboxForm(form)),
			delete: (form) => remove(toFormboxForm(form)),
			importForm: () => setImportOpen(true),
		},
		dialogs,
	};
}
