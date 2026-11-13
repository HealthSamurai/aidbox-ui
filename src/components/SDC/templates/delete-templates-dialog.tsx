import * as HSComp from "@health-samurai/react-components";
import type { TemplateFormReference } from "../formbox/api/templates";
import { getFormBuilderUrl } from "../formbox/utils";

/**
 * Confirm deleting templates. Forms that render through them keep pointing at
 * them, so those forms are listed and the action becomes "Force delete".
 */
export function DeleteTemplatesDialog({
	count,
	forms,
	isDeleting,
	onConfirm,
	onOpenChange,
	open,
}: {
	count: number;
	forms: TemplateFormReference[];
	isDeleting: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const single = count === 1;
	const force = forms.length > 0;
	const formCount = `${forms.length} ${forms.length === 1 ? "form" : "forms"}`;
	return (
		<HSComp.AlertDialog open={open} onOpenChange={onOpenChange}>
			<HSComp.AlertDialogContent data-test-id="delete-templates-dialog">
				<HSComp.AlertDialogHeader>
					<HSComp.AlertDialogTitle data-test-id="delete-templates-dialog__title">
						{single ? "Delete Template" : `Delete ${count} Templates`}
					</HSComp.AlertDialogTitle>
				</HSComp.AlertDialogHeader>
				<HSComp.AlertDialogDescription asChild>
					<div className="space-y-4">
						<p>
							{single
								? "Are you sure you want to delete this template?"
								: `Are you sure you want to delete ${count} templates?`}
						</p>
						{force ? (
							<div className="space-y-2">
								<p>
									{single
										? `Template is used by ${formCount}. Deleting it will leave those forms referencing a missing template:`
										: `Selected templates are used by ${formCount}. Deleting them will leave those forms referencing missing templates:`}
								</p>
								<ul
									className="max-h-40 space-y-1 overflow-auto italic"
									data-test-id="delete-templates-dialog__form-usage-list"
								>
									{forms.map((form, index) => (
										<li key={form.id}>
											<span>{`${index + 1}. `}</span>
											<a
												href={getFormBuilderUrl(form.id)}
												target="_blank"
												rel="noreferrer"
												className="text-text-link underline"
											>
												{form.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</HSComp.AlertDialogDescription>
				<HSComp.AlertDialogFooter>
					<HSComp.AlertDialogCancel
						data-test-id="delete-templates-dialog__cancel-button"
						disabled={isDeleting}
					>
						Cancel
					</HSComp.AlertDialogCancel>
					<HSComp.Button
						danger
						disabled={isDeleting}
						onClick={onConfirm}
						data-test-id="delete-templates-dialog__confirm-button"
					>
						{isDeleting ? "Deleting..." : force ? "Force delete" : "Delete"}
					</HSComp.Button>
				</HSComp.AlertDialogFooter>
			</HSComp.AlertDialogContent>
		</HSComp.AlertDialog>
	);
}
