import type {
	OperationOutcome,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { SDCConfig } from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4";
import * as HSComp from "@health-samurai/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { useQuestionnaireThemes } from "./api";
import { ConfigurationForm } from "./form";
import {
	type ConfigurationFormValues,
	configurationFormSchema,
	configurationToFormValues,
	formValuesToConfiguration,
} from "./form-values";

type Props = {
	resource: Resource;
	onResourceChange: (next: Resource) => void;
	/** Save / Delete from `ResourceEditor`, shown in the top bar. */
	actions?: React.ReactNode;
	saveError?: OperationOutcome | null;
};

/**
 * The Formbox configuration form as a ResourceEditor tab. It edits the same
 * resource as the Edit tab: every change is written back through
 * `onResourceChange`, and the editor's own Save persists it.
 */
export const SDCConfigBuilderContent = (props: Props) => {
	const themes = useQuestionnaireThemes();

	return (
		<div className="flex h-full min-h-0 flex-col">
			{props.actions && (
				<div className="flex items-center gap-4 bg-bg-secondary flex-none h-10 border-b px-4">
					{props.actions}
				</div>
			)}
			{themes.isLoading ? (
				<div className="flex grow items-center justify-center text-text-secondary">
					Loading...
				</div>
			) : (
				<HSComp.ResizablePanelGroup
					direction="vertical"
					className="grow min-h-0"
				>
					<HSComp.ResizablePanel minSize={20} className="flex flex-col">
						<ConfigurationBuilder {...props} themes={themes.data ?? []} />
					</HSComp.ResizablePanel>
					{props.saveError && (
						<>
							<HSComp.ResizableHandle />
							<HSComp.ResizablePanel defaultSize={30} minSize={10}>
								<HSComp.OperationOutcomeView
									resource={
										props.saveError as unknown as HSComp.OperationOutcome
									}
									className="h-full overflow-auto"
								/>
							</HSComp.ResizablePanel>
						</>
					)}
				</HSComp.ResizablePanelGroup>
			)}
		</div>
	);
};

function ConfigurationBuilder({
	resource,
	onResourceChange,
	themes,
}: Props & {
	themes: React.ComponentProps<typeof ConfigurationForm>["themes"];
}) {
	const [search, setSearch] = React.useState("");
	const form = useForm<ConfigurationFormValues>({
		resolver: zodResolver(configurationFormSchema),
		mode: "onChange",
		defaultValues: configurationToFormValues(resource as SDCConfig),
	});

	// The form fills some fields itself when it mounts (the default theme);
	// that is not an edit, so nothing is written back until the user acts.
	const touchedRef = React.useRef(false);
	const resourceRef = React.useRef(resource);
	const onResourceChangeRef = React.useRef(onResourceChange);
	React.useEffect(() => {
		resourceRef.current = resource;
		onResourceChangeRef.current = onResourceChange;
	});

	React.useEffect(() => {
		const subscription = form.watch(() => {
			if (!touchedRef.current) return;
			let next: SDCConfig;
			try {
				next = formValuesToConfiguration(
					form.getValues(),
					resourceRef.current as SDCConfig,
				);
			} catch {
				// A half-typed JSON field: keep the last resource that parsed.
				return;
			}
			onResourceChangeRef.current(next as Resource);
		});
		return () => subscription.unsubscribe();
	}, [form]);

	const markTouched = () => {
		touchedRef.current = true;
	};

	return (
		<fieldset
			aria-label="Configuration builder"
			className="flex min-h-0 flex-1 flex-col"
			onPointerDownCapture={markTouched}
			onKeyDownCapture={markTouched}
		>
			<ConfigurationForm
				form={form}
				onSubmit={() => {}}
				onSearchChange={setSearch}
				search={search}
				themes={themes}
			/>
		</fieldset>
	);
}
