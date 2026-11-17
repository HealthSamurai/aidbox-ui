import * as HSComp from "@health-samurai/react-components";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, FileInput, Plus } from "lucide-react";
import { getFormBuilderUrl } from "../formbox/utils";
import type { Form } from "./api";

/**
 * Create or import forms. A package is made of Questionnaires, so the
 * selection prefills a new one only while it holds nothing else.
 */
export function FormsToolbar({
	selectedForms,
	onClearSelection,
	onImport,
}: {
	selectedForms: Form[];
	onClearSelection: () => void;
	onImport: () => void;
}) {
	const selectedFormIds = selectedForms.every(
		(form) => form.resourceType === "Questionnaire",
	)
		? selectedForms.flatMap((form) => (form.id ? [form.id] : []))
		: [];
	const navigate = useNavigate();
	const openNewForm = () => window.location.assign(getFormBuilderUrl());

	return (
		<div className="flex items-center gap-2">
			<HSComp.Button
				size="small"
				variant="ghost"
				className="h-8 gap-1 border-0 bg-bg-tertiary px-3 text-text-quternary hover:bg-bg-tertiary hover:text-text-secondary"
				data-test-id="forms-toolbar__new-plan-definition-button"
				onClick={() =>
					navigate({
						to: "/forms/packages/new",
						search:
							selectedFormIds.length > 0 ? { forms: selectedFormIds } : {},
					})
				}
			>
				<Plus className="size-4" />
				New Package
				{selectedFormIds.length > 0 ? (
					<span
						className="flex size-4.5 items-center justify-center rounded-full bg-(--color-elements-assistive) text-white text-xs"
						data-test-id="forms-toolbar__new-plan-definition-count"
					>
						{selectedFormIds.length}
					</span>
				) : null}
			</HSComp.Button>
			{selectedForms.length > 0 ? (
				<HSComp.Button
					size="small"
					variant="ghost"
					onClick={onClearSelection}
					data-test-id="forms-toolbar__clear-selection-button"
				>
					Clear selection
				</HSComp.Button>
			) : null}
			<HSComp.SplitButton
				size="small"
				className="*:data-[slot=button]:h-8 *:data-[slot=button]:px-3 *:data-[slot=button]:gap-2 *:data-[slot=dropdown-menu-trigger]:h-8 *:data-[slot=dropdown-menu-trigger]:border-l *:data-[slot=dropdown-menu-trigger]:border-white/30"
				data-test-id="forms-toolbar"
			>
				<HSComp.Button
					size="small"
					data-test-id="forms-toolbar__new-form-button"
					onClick={openNewForm}
				>
					<Plus />
					New Form
				</HSComp.Button>
				<HSComp.DropdownMenu>
					<HSComp.DropdownMenuTrigger asChild>
						<HSComp.Button
							size="small"
							aria-label="Open form creation menu"
							data-test-id="forms-toolbar__menu-button"
						>
							<ChevronDown />
						</HSComp.Button>
					</HSComp.DropdownMenuTrigger>
					<HSComp.DropdownMenuContent
						align="end"
						data-test-id="forms-toolbar__menu"
					>
						<HSComp.DropdownMenuItem
							className="justify-start"
							data-test-id="forms-toolbar__menu-new-form-button"
							onClick={openNewForm}
						>
							<Plus className="size-4" />
							New Form
						</HSComp.DropdownMenuItem>
						<HSComp.DropdownMenuItem
							className="justify-start"
							data-test-id="forms-toolbar__menu-import-button"
							onClick={onImport}
						>
							<FileInput className="size-4" />
							Import
						</HSComp.DropdownMenuItem>
					</HSComp.DropdownMenuContent>
				</HSComp.DropdownMenu>
			</HSComp.SplitButton>
		</div>
	);
}
