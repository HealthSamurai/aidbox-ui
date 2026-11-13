import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	PlanDefinition,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import {
	Alert,
	AlertDescription,
	IconButton,
} from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { sdcRequest } from "../../api/plan-definitions";
import { Renderer } from "../../components/renderer";
import { PlanDefinitionPreview } from "./plan-definition-preview";

export type PlanDefinitionQuickLookTarget = Questionnaire | "plan-definition";

function QuickLookHeader({
	onRefresh,
	onClose,
	refreshing = false,
	canRefresh = true,
}: {
	onRefresh: () => void;
	onClose: () => void;
	refreshing?: boolean;
	canRefresh?: boolean;
}) {
	return (
		<header className="box-content flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
			<h2 className="typo-body font-medium text-text-primary">Quick View</h2>
			<div className="flex items-center gap-2">
				<IconButton
					variant="ghost"
					aria-label="Refresh quick view"
					title="Refresh quick view"
					data-test-id="plan-definition-quick-look__refresh-button"
					onClick={onRefresh}
					disabled={refreshing || !canRefresh}
					aria-busy={refreshing}
					icon={
						refreshing ? (
							<LoaderCircle className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)
					}
				/>
				<IconButton
					variant="ghost"
					aria-label="Close quick look"
					title="Close quick look"
					data-test-id="plan-definition-quick-look__close-button"
					onClick={onClose}
					icon={<X className="size-4" />}
				/>
			</div>
		</header>
	);
}

function QuestionnaireQuickLook({
	questionnaire,
	onClose,
}: {
	questionnaire: Questionnaire;
	onClose: () => void;
}) {
	const aidboxClient = useAidboxClient();
	const queryClient = useQueryClient();
	const [renderedQuestionnaire, setRenderedQuestionnaire] =
		useState(questionnaire);
	const refresh = useMutation({
		// An explicit refresh must bypass the query cache; AidboxClient never
		// uses the HTTP cache.
		mutationFn: (id: string) =>
			sdcRequest<Questionnaire>(
				aidboxClient,
				`/sdc/Questionnaire/${encodeURIComponent(id)}`,
			),
		onSuccess: (latest, id) => {
			setRenderedQuestionnaire(latest);
			queryClient.setQueryData(["questionnaire", id], latest);
		},
	});

	return (
		<>
			<QuickLookHeader
				onRefresh={() => {
					if (questionnaire.id) refresh.mutate(questionnaire.id);
				}}
				onClose={onClose}
				refreshing={refresh.isPending}
				canRefresh={Boolean(questionnaire.id)}
			/>
			{refresh.isError && (
				<div className="shrink-0 p-4">
					<Alert variant="warning">
						<AlertCircle className="size-4" />
						<AlertDescription>
							Could not refresh questionnaire. The last loaded version is still
							displayed. {refresh.error.message}
						</AlertDescription>
					</Alert>
				</div>
			)}
			<Renderer questionnaire={renderedQuestionnaire} />
		</>
	);
}

export function PlanDefinitionQuickLook({
	target,
	planDefinition,
	onClose,
}: {
	target: PlanDefinitionQuickLookTarget;
	planDefinition: PlanDefinition;
	onClose: () => void;
}) {
	return (
		<section
			className="flex h-full min-h-0 min-w-0 flex-col bg-bg-primary"
			aria-label={
				target === "plan-definition"
					? "Package quick look"
					: "Questionnaire quick look"
			}
			data-test-id="plan-definition-quick-look__panel"
		>
			{target === "plan-definition" ? (
				<PlanDefinitionPreview
					planDefinition={planDefinition}
					renderHeader={(onRefresh) => (
						<QuickLookHeader onRefresh={onRefresh} onClose={onClose} />
					)}
				/>
			) : (
				<QuestionnaireQuickLook
					key={target.id ?? `${target.url}|${target.version}`}
					questionnaire={target}
					onClose={onClose}
				/>
			)}
		</section>
	);
}
