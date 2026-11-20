import type { QuestionnaireTheme } from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4/index";
import { Form, Input, ScrollArea } from "@health-samurai/react-components";
import { Search } from "lucide-react";
import { useDeferredValue } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ConfigurationEditorSidebar } from "./editor-sidebar";
import type { ConfigurationFormValues } from "./form-values";
import { ConfigurationSectionsRenderer } from "./renderer";
import {
	filterConfigurationSchema,
	getVisibleConfigurationCategoryKeys,
} from "./schema";

export function ConfigurationForm({
	form,
	onSubmit,
	onSearchChange,
	search,
	themes,
}: {
	form: UseFormReturn<ConfigurationFormValues>;
	onSubmit: (values: ConfigurationFormValues) => void | Promise<void>;
	onSearchChange: (value: string) => void;
	search: string;
	themes: QuestionnaireTheme[];
}) {
	const deferredSearch = useDeferredValue(search);
	const visibleSections = filterConfigurationSchema(deferredSearch);
	const visibleCategories =
		getVisibleConfigurationCategoryKeys(visibleSections);

	return (
		<Form {...form}>
			<form
				className="flex min-h-0 flex-1 overflow-hidden"
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<div className="h-full min-h-0 w-[272px] shrink-0 border-r border-border-secondary">
					<ConfigurationEditorSidebar visibleCategories={visibleCategories} />
				</div>
				<div className="min-w-0 flex-1 overflow-hidden">
					<div className="relative flex h-full flex-col">
						<div className="relative z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
							<div className="@container mx-auto max-w-[990px] px-8">
								<Input
									data-test-id="configuration-form__search-input"
									value={search}
									onChange={(event) => onSearchChange(event.target.value)}
									placeholder="Search Configuration"
									leftSlot={<Search size={16} />}
								/>
							</div>
						</div>

						<ScrollArea
							id="configuration-form-scroll-area"
							className="min-h-0 flex-1"
						>
							<div className="@container mx-auto max-w-[990px] pb-20 pt-2">
								{visibleSections.length === 0 ? (
									<p
										className="py-8 text-center text-text-secondary"
										data-test-id="configuration-form__empty-text"
									>
										No configuration settings found
									</p>
								) : (
									<ConfigurationSectionsRenderer
										form={form}
										sections={visibleSections}
										themes={themes}
									/>
								)}
							</div>
						</ScrollArea>
					</div>
				</div>
			</form>
		</Form>
	);
}
