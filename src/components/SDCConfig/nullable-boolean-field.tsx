import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import type { Control, FieldPathByValue } from "react-hook-form";
import type {
	ConfigurationFormValues,
	NullableBooleanValue,
} from "./form-values";
import { ConfigurationSelect as Select } from "./select";

const INHERIT_VALUE = "__inherit__";

export function NullableBooleanField({
	control,
	defaultLabel,
	description,
	falseLabel,
	label,
	name,
	trueLabel,
}: {
	control: Control<ConfigurationFormValues>;
	defaultLabel?: string;
	description: string;
	falseLabel?: string;
	label: string;
	name: FieldPathByValue<ConfigurationFormValues, NullableBooleanValue>;
	trueLabel?: string;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className="grid gap-3 rounded-md border border-border-primary bg-bg-primary p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
					<div className="space-y-1">
						<FormLabel>{label}</FormLabel>
						<FormDescription>{description}</FormDescription>
					</div>
					<div className="space-y-2">
						<FormControl>
							<Select
								value={field.value || INHERIT_VALUE}
								onValueChange={(value) =>
									field.onChange(value === INHERIT_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									className="bg-bg-primary"
									data-test-id={`configuration-form__${name}`}
								>
									<SelectValue placeholder={defaultLabel ?? "Default"} />
								</SelectTrigger>
								<AppSelectContent>
									<AppSelectItem
										data-test-id={`configuration-form__${name}-option`}
										value={INHERIT_VALUE}
									>
										{defaultLabel ?? "Default"}
									</AppSelectItem>
									<AppSelectItem
										data-test-id={`configuration-form__${name}-option`}
										value="true"
									>
										{trueLabel ?? "Enabled"}
									</AppSelectItem>
									<AppSelectItem
										data-test-id={`configuration-form__${name}-option`}
										value="false"
									>
										{falseLabel ?? "Disabled"}
									</AppSelectItem>
								</AppSelectContent>
							</Select>
						</FormControl>
						<FormMessage />
					</div>
				</FormItem>
			)}
		/>
	);
}
