import { getFormLabel } from "@aidbox-ui/components/Forms/api/forms";
import { canonical } from "@aidbox-ui/components/Forms/api/plan-definitions";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@health-samurai/react-components";
import { useState } from "react";

/** Select questionnaires to add together, retaining the selection across searches. */
export function PlanDefinitionAddQuestionnairesDialog({
	questionnaires,
	onAdd,
	onOpenChange,
}: {
	questionnaires: Questionnaire[];
	onAdd: (questionnaires: Questionnaire[]) => void;
	onOpenChange: (open: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Map<string, Questionnaire>>(
		new Map(),
	);
	const search = query.trim().toLowerCase();
	const matches = questionnaires.filter((questionnaire) =>
		`${getFormLabel(questionnaire)} ${canonical(questionnaire)}`
			.toLowerCase()
			.includes(search),
	);

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[36rem]"
				data-test-id="plan-definition-add-forms-dialog"
			>
				<DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
					<DialogTitle>Add forms</DialogTitle>
				</DialogHeader>
				<div className="shrink-0 border-b px-6 py-3">
					<Input
						aria-label="Search questionnaires"
						data-test-id="plan-definition-add-forms-dialog__search-input"
						placeholder="Search questionnaires…"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
				<div className="min-h-0 max-h-80 overflow-y-auto overscroll-contain">
					{matches.length === 0 && (
						<p className="px-6 py-8 text-center text-sm text-text-secondary">
							No questionnaires found.
						</p>
					)}
					{matches.map((questionnaire) => {
						const reference = canonical(questionnaire);
						const key = questionnaire.id ?? reference;
						const title = getFormLabel(questionnaire);
						return (
							<Label
								key={key}
								className="cursor-pointer gap-3 border-b px-6 py-3 last:border-b-0 hover:bg-bg-secondary"
								data-test-id="plan-definition-add-forms-dialog__row"
								data-form-id={questionnaire.id}
							>
								<Checkbox
									size="small"
									data-test-id="plan-definition-add-forms-dialog__select-checkbox"
									checked={selected.has(key)}
									onCheckedChange={(checked) => {
										setSelected((current) => {
											const next = new Map(current);
											if (checked) next.set(key, questionnaire);
											else next.delete(key);
											return next;
										});
									}}
								/>
								<span className="min-w-0 flex-1">
									<span
										className="block truncate text-sm leading-5"
										title={title}
									>
										{title}
									</span>
									<span
										className="block truncate text-xs leading-5 text-text-secondary"
										title={reference}
									>
										{reference}
									</span>
								</span>
							</Label>
						);
					})}
				</div>
				<DialogFooter className="shrink-0 border-t px-6 py-4">
					<Button
						type="button"
						variant="secondary"
						data-test-id="plan-definition-add-forms-dialog__cancel-button"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						data-test-id="plan-definition-add-forms-dialog__add-button"
						disabled={selected.size === 0}
						onClick={() => onAdd([...selected.values()])}
					>
						Add{selected.size > 0 && ` (${selected.size})`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
