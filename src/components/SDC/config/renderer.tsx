import {
	Button,
	Checkbox,
	CodeEditor,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	IconButton,
	Input,
	MultiCombobox,
	SelectTrigger,
	SelectValue,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
} from "@health-samurai/react-components";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import type { QuestionnaireTheme } from "../../../fhir-types/io-health-samurai-sdc-r4";
import { AppSelectContent, AppSelectItem } from "../shared/app-select";
import { getQuestionnaireThemeLabel, useStorageAccountReferences } from "./api";
import type { ConfigurationFormValues } from "./form-values";
import { NullableBooleanField } from "./nullable-boolean-field";
import type {
	ConfigurationArrayNode,
	ConfigurationFieldNode,
	ConfigurationGroupNode,
	ConfigurationNode,
	FilteredConfigurationSection,
	FilteredConfigurationSubsection,
} from "./schema";
import { buildSectionId, categoryKey } from "./schema";
import { ConfigurationSelect as Select } from "./select";

const NO_THEME_VALUE = "__none__";
const INHERIT_LAYOUT_VALUE = "__inherit__";

function gridClass(cols?: 1 | 2 | 3) {
	switch (cols) {
		case 2:
			return "grid gap-4 md:grid-cols-2";
		case 3:
			return "grid gap-4 md:grid-cols-3";
		default:
			return "grid gap-4";
	}
}

function spanClass(span?: 1 | 2 | 3) {
	switch (span) {
		case 2:
			return "self-start md:col-span-2";
		case 3:
			return "self-start md:col-span-3";
		default:
			return "self-start";
	}
}

function getStringSelectValue(value: unknown) {
	return typeof value === "string" ? value : "";
}

function getValueAtPath(value: unknown, path: string) {
	return path.split(".").reduce<unknown>((currentValue, segment) => {
		if (!currentValue || typeof currentValue !== "object") {
			return undefined;
		}

		return (currentValue as Record<string, unknown>)[segment];
	}, value);
}

function normalizeQuestionnaireThemeReference(value: string) {
	const trimmedValue = value.trim();

	if (!trimmedValue) {
		return "";
	}

	if (trimmedValue.startsWith("QuestionnaireTheme/")) {
		return trimmedValue;
	}

	const matchedId = trimmedValue.match(
		/(?:^|\/)QuestionnaireTheme\/([^/?#]+)/,
	)?.[1];

	if (matchedId) {
		return `QuestionnaireTheme/${decodeURIComponent(matchedId)}`;
	}

	if (
		!trimmedValue.includes("/") &&
		!trimmedValue.includes("?") &&
		!trimmedValue.includes("#")
	) {
		return `QuestionnaireTheme/${trimmedValue}`;
	}

	return trimmedValue;
}

function resolveSelectOptions(
	options: ConfigurationFieldNode["options"],
	currentValue: string,
) {
	if (
		!currentValue ||
		options?.some((option) => option.value === currentValue)
	) {
		return options;
	}

	return [...(options ?? []), { label: currentValue, value: currentValue }];
}

function ThemeSelectField({
	fieldNode,
	form,
	path,
	themes,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
	themes: QuestionnaireTheme[];
}) {
	const defaultValue = normalizeQuestionnaireThemeReference(
		getStringSelectValue(getValueAtPath(form.formState.defaultValues, path)),
	);

	useEffect(() => {
		if (!defaultValue) {
			return;
		}

		const currentValue = normalizeQuestionnaireThemeReference(
			getStringSelectValue(form.getValues(path as never)),
		);

		if (!currentValue) {
			form.setValue(path as never, defaultValue as never, {
				shouldDirty: false,
			});
		}
	}, [defaultValue, form, path]);

	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => {
				const currentValue =
					normalizeQuestionnaireThemeReference(
						getStringSelectValue(field.value),
					) || defaultValue;
				const options = themes
					.filter((theme) => Boolean(theme.id))
					.map((theme) => ({
						label: getQuestionnaireThemeLabel(theme),
						value: `QuestionnaireTheme/${theme.id}`,
					}));
				const resolvedOptions =
					currentValue &&
					!options.some((option) => option.value === currentValue)
						? [
								...options,
								{
									label: currentValue.split("/").at(-1) ?? currentValue,
									value: currentValue,
								},
							]
						: options;

				return (
					<FormItem className={spanClass(fieldNode.span)}>
						<FormLabel>{fieldNode.label}</FormLabel>
						<FormControl>
							<Select
								value={currentValue || NO_THEME_VALUE}
								onValueChange={(value) =>
									field.onChange(value === NO_THEME_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									className="bg-bg-primary"
									data-test-id={`configuration-form__${path}`}
								>
									<SelectValue placeholder="No theme" />
								</SelectTrigger>
								<AppSelectContent>
									<AppSelectItem
										data-test-id={`configuration-form__${path}-option`}
										value={NO_THEME_VALUE}
									>
										No theme
									</AppSelectItem>
									{resolvedOptions.map((option) => (
										<AppSelectItem
											key={option.value}
											data-test-id={`configuration-form__${path}-option`}
											value={option.value}
										>
											{option.label}
										</AppSelectItem>
									))}
								</AppSelectContent>
							</Select>
						</FormControl>
						{fieldNode.description ? (
							<FormDescription>{fieldNode.description}</FormDescription>
						) : null}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

function StaticSelectField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => {
				const currentValue = getStringSelectValue(field.value);
				const options = fieldNode.options;

				return (
					<FormItem className={spanClass(fieldNode.span)}>
						<FormLabel>{fieldNode.label}</FormLabel>
						<FormControl>
							<Select
								value={currentValue || INHERIT_LAYOUT_VALUE}
								onValueChange={(value) =>
									field.onChange(value === INHERIT_LAYOUT_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									className="bg-bg-primary"
									data-test-id={`configuration-form__${path}`}
								>
									<SelectValue
										placeholder={fieldNode.placeholder ?? "Default"}
									/>
								</SelectTrigger>
								<AppSelectContent>
									{options?.map((option) => (
										<AppSelectItem
											key={`${fieldNode.id}-${option.label}`}
											data-test-id={`configuration-form__${path}-option`}
											value={option.value || INHERIT_LAYOUT_VALUE}
										>
											{option.label}
										</AppSelectItem>
									))}
								</AppSelectContent>
							</Select>
						</FormControl>
						{fieldNode.description ? (
							<FormDescription>{fieldNode.description}</FormDescription>
						) : null}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

function BooleanSelectField({
	exclusiveBooleanScope,
	fieldNode,
	form,
	path,
}: {
	exclusiveBooleanScope?: {
		arrayPath: string;
		rowCount: number;
		rowIndex: number;
	};
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => (
				<FormItem className={spanClass(fieldNode.span)}>
					<FormLabel>{fieldNode.label}</FormLabel>
					<FormControl>
						<Select
							value={String(Boolean(field.value))}
							onValueChange={(value) => {
								const nextValue = value === "true";

								if (exclusiveBooleanScope && nextValue) {
									for (
										let currentIndex = 0;
										currentIndex < exclusiveBooleanScope.rowCount;
										currentIndex += 1
									) {
										form.setValue(
											`${exclusiveBooleanScope.arrayPath}.${currentIndex}.${fieldNode.path}` as never,
											(currentIndex ===
												exclusiveBooleanScope.rowIndex) as never,
											{ shouldDirty: true, shouldValidate: true },
										);
									}

									return;
								}

								field.onChange(nextValue);
							}}
						>
							<SelectTrigger
								className="bg-bg-primary"
								data-test-id={`configuration-form__${path}`}
							>
								<SelectValue placeholder={fieldNode.placeholder ?? "Default"} />
							</SelectTrigger>
							<AppSelectContent>
								{fieldNode.options?.map((option) => (
									<AppSelectItem
										key={`${fieldNode.id}-${option.label}`}
										data-test-id={`configuration-form__${path}-option`}
										value={option.value}
									>
										{option.label}
									</AppSelectItem>
								))}
							</AppSelectContent>
						</Select>
					</FormControl>
					{fieldNode.description ? (
						<FormDescription>{fieldNode.description}</FormDescription>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

function StorageAccountSelectField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	const storageAccountsQuery = useStorageAccountReferences();

	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => {
				const currentValue = getStringSelectValue(field.value);
				const options = resolveSelectOptions(
					[...(fieldNode.options ?? []), ...(storageAccountsQuery.data ?? [])],
					currentValue,
				);

				return (
					<FormItem className={spanClass(fieldNode.span)}>
						<FormLabel>{fieldNode.label}</FormLabel>
						<FormControl>
							<Select
								value={currentValue || INHERIT_LAYOUT_VALUE}
								onValueChange={(value) =>
									field.onChange(value === INHERIT_LAYOUT_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									className="bg-bg-primary"
									data-test-id={`configuration-form__${path}`}
								>
									<SelectValue
										placeholder={
											storageAccountsQuery.isLoading
												? "Loading accounts..."
												: (fieldNode.placeholder ?? "Default")
										}
									/>
								</SelectTrigger>
								<AppSelectContent>
									{options?.map((option) => (
										<AppSelectItem
											key={`${fieldNode.id}-${option.label}`}
											data-test-id={`configuration-form__${path}-option`}
											value={option.value || INHERIT_LAYOUT_VALUE}
										>
											{option.label}
										</AppSelectItem>
									))}
								</AppSelectContent>
							</Select>
						</FormControl>
						{fieldNode.description ? (
							<FormDescription>{fieldNode.description}</FormDescription>
						) : null}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

function MultiSelectField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => (
				<FormItem className={spanClass(fieldNode.span)}>
					<FormLabel>{fieldNode.label}</FormLabel>
					<FormControl>
						<MultiCombobox
							data-test-id={`configuration-form__${path}`}
							className="bg-bg-primary"
							emptyText="No options found."
							options={fieldNode.options ?? []}
							placeholder={fieldNode.placeholder ?? "Select options..."}
							searchPlaceholder="Search..."
							value={Array.isArray(field.value) ? field.value : []}
							onValueChange={field.onChange}
						/>
					</FormControl>
					{fieldNode.description ? (
						<FormDescription>{fieldNode.description}</FormDescription>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

function TextField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	const commonClasses = "bg-bg-primary";

	if (fieldNode.widget === "textarea") {
		return (
			<FormField
				control={form.control}
				name={path as never}
				render={({ field }) => (
					<FormItem className={spanClass(fieldNode.span)}>
						<FormLabel>{fieldNode.label}</FormLabel>
						<FormControl>
							<Textarea
								{...field}
								data-test-id={`configuration-form__${path}`}
								className={commonClasses}
								placeholder={fieldNode.placeholder}
								rows={fieldNode.rows}
								style={
									fieldNode.rows
										? { minHeight: `${fieldNode.rows * 1.5 + 2}rem` }
										: undefined
								}
							/>
						</FormControl>
						{fieldNode.description ? (
							<FormDescription>{fieldNode.description}</FormDescription>
						) : null}
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	}

	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => (
				<FormItem className={spanClass(fieldNode.span)}>
					<FormLabel>{fieldNode.label}</FormLabel>
					<FormControl>
						<Input
							{...field}
							data-test-id={`configuration-form__${path}`}
							autoComplete="off"
							className={commonClasses}
							inputMode={fieldNode.inputMode}
							placeholder={fieldNode.placeholder}
						/>
					</FormControl>
					{fieldNode.description ? (
						<FormDescription>{fieldNode.description}</FormDescription>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

function JsonEditorField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	const editorHeight = fieldNode.rows
		? `${fieldNode.rows * 1.5 + 2}rem`
		: "12rem";

	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => (
				<FormItem className={spanClass(fieldNode.span)}>
					<FormLabel>{fieldNode.label}</FormLabel>
					<FormControl>
						<div
							className="overflow-hidden rounded-md border border-border-primary bg-bg-primary"
							data-test-id={`configuration-form__${path}`}
							style={{ height: editorHeight }}
						>
							<CodeEditor
								additionalExtensions={fieldNode.editorExtensions}
								currentValue={(field.value as string) ?? ""}
								foldGutter={false}
								lineNumbers={false}
								mode="json"
								onChange={field.onChange}
							/>
						</div>
					</FormControl>
					{fieldNode.description ? (
						<FormDescription>{fieldNode.description}</FormDescription>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export function KeyValueTableField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	const fieldArray = useFieldArray({
		control: form.control,
		name: path as never,
	});

	return (
		<FormField
			control={form.control}
			name={path as never}
			render={() => (
				<FormItem className={spanClass(fieldNode.span)}>
					<FormLabel>{fieldNode.label}</FormLabel>
					<div className="overflow-hidden rounded-md border border-border-primary bg-bg-primary">
						<Table
							aria-label={`${fieldNode.label} key value pairs`}
							className="min-w-[32rem]"
						>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[42%]">Header</TableHead>
									<TableHead>Value</TableHead>
									<TableHead className="w-12">
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{fieldArray.fields.length === 0 ? (
									<TableRow>
										<TableCell
											className="whitespace-normal px-4 py-5 text-center text-text-secondary"
											colSpan={3}
										>
											{fieldNode.emptyText ?? "No entries configured."}
										</TableCell>
									</TableRow>
								) : null}

								{fieldArray.fields.map((entry, index) => (
									<TableRow key={entry.id} className="align-top">
										<TableCell className="whitespace-normal px-3 py-2">
											<FormField
												control={form.control}
												name={`${path}.${index}.key` as never}
												render={({ field }) => (
													<FormItem className="space-y-1">
														<FormControl>
															<Input
																{...field}
																aria-label={`Header ${index + 1} name`}
																autoComplete="off"
																className="bg-bg-primary"
																placeholder={fieldNode.keyPlaceholder}
																value={(field.value as string) ?? ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</TableCell>
										<TableCell className="whitespace-normal px-3 py-2">
											<FormField
												control={form.control}
												name={`${path}.${index}.value` as never}
												render={({ field }) => (
													<FormItem className="space-y-1">
														<FormControl>
															<Input
																{...field}
																aria-label={`Header ${index + 1} value`}
																autoComplete="off"
																className="bg-bg-primary"
																placeholder={fieldNode.valuePlaceholder}
																value={(field.value as string) ?? ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</TableCell>
										<TableCell className="px-2 py-2 text-right">
											<IconButton
												aria-label={`Remove header ${index + 1}`}
												title={`Remove header ${index + 1}`}
												type="button"
												variant="ghost"
												onClick={() => fieldArray.remove(index)}
												className="text-text-error-primary hover:text-text-error-primary hover:bg-bg-error-primary"
												icon={<Trash2 className="size-4" />}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<Button
						className="mt-3 w-fit justify-self-start"
						size="small"
						type="button"
						variant="secondary"
						onClick={() => fieldArray.append({ key: "", value: "" } as never)}
					>
						<Plus className="size-4" />
						{fieldNode.addLabel ?? "Add row"}
					</Button>
					{fieldNode.description ? (
						<FormDescription>{fieldNode.description}</FormDescription>
					) : null}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

function CheckboxField({
	fieldNode,
	form,
	path,
}: {
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
}) {
	return (
		<FormField
			control={form.control}
			name={path as never}
			render={({ field }) => {
				return (
					<FormItem className="overflow-hidden rounded-md border border-border-primary bg-bg-primary">
						<FormLabel className="grid w-full cursor-pointer gap-x-3 gap-y-1 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
							<span className="md:col-start-1">{fieldNode.label}</span>
							{fieldNode.description ? (
								<span className="text-sm text-text-secondary md:col-start-1">
									{fieldNode.description}
								</span>
							) : null}
							<div
								className={
									fieldNode.description
										? "md:col-start-2 md:row-start-1 md:row-end-3 md:self-center"
										: "md:col-start-2 md:self-center"
								}
							>
								<FormControl>
									<Checkbox
										data-test-id={`configuration-form__${path}`}
										checked={Boolean(field.value)}
										onCheckedChange={(checked) =>
											field.onChange(checked === true)
										}
									/>
								</FormControl>
							</div>
						</FormLabel>
						<FormMessage className="px-4 pb-4" />
					</FormItem>
				);
			}}
		/>
	);
}

type ArrayExclusiveScope = {
	arrayPath: string;
	fieldIds: string[];
	rowCount: number;
	rowIndex: number;
};

function FieldRenderer({
	arrayExclusiveScope,
	exclusiveBooleanScope,
	fieldNode,
	form,
	path,
	themes,
}: {
	arrayExclusiveScope?: ArrayExclusiveScope;
	exclusiveBooleanScope?: {
		arrayPath: string;
		rowCount: number;
		rowIndex: number;
	};
	fieldNode: ConfigurationFieldNode;
	form: UseFormReturn<ConfigurationFormValues>;
	path: string;
	themes: QuestionnaireTheme[];
}) {
	const resolvedExclusiveBooleanScope =
		exclusiveBooleanScope ??
		(arrayExclusiveScope?.fieldIds.includes(fieldNode.id)
			? {
					arrayPath: arrayExclusiveScope.arrayPath,
					rowCount: arrayExclusiveScope.rowCount,
					rowIndex: arrayExclusiveScope.rowIndex,
				}
			: undefined);

	switch (fieldNode.widget) {
		case "triStateBoolean":
			return (
				<NullableBooleanField
					control={form.control}
					defaultLabel={fieldNode.defaultLabel}
					description={fieldNode.description ?? ""}
					falseLabel={fieldNode.falseLabel}
					label={fieldNode.label}
					name={path as never}
					trueLabel={fieldNode.trueLabel}
				/>
			);
		case "checkbox":
			return <CheckboxField fieldNode={fieldNode} form={form} path={path} />;
		case "jsonEditor":
			return <JsonEditorField fieldNode={fieldNode} form={form} path={path} />;
		case "keyValueTable":
			return (
				<KeyValueTableField fieldNode={fieldNode} form={form} path={path} />
			);
		case "select":
			return (
				<StaticSelectField fieldNode={fieldNode} form={form} path={path} />
			);
		case "booleanSelect":
			return (
				<BooleanSelectField
					exclusiveBooleanScope={resolvedExclusiveBooleanScope}
					fieldNode={fieldNode}
					form={form}
					path={path}
				/>
			);
		case "storageAccountSelect":
			return (
				<StorageAccountSelectField
					fieldNode={fieldNode}
					form={form}
					path={path}
				/>
			);
		case "multiSelect":
			return <MultiSelectField fieldNode={fieldNode} form={form} path={path} />;
		case "themeSelect":
			return (
				<ThemeSelectField
					fieldNode={fieldNode}
					form={form}
					path={path}
					themes={themes}
				/>
			);
		default:
			return <TextField fieldNode={fieldNode} form={form} path={path} />;
	}
}

function NodesRenderer({
	arrayExclusiveScope,
	form,
	nodes,
	pathPrefix,
	themes,
}: {
	arrayExclusiveScope?: ArrayExclusiveScope;
	form: UseFormReturn<ConfigurationFormValues>;
	nodes: ConfigurationNode[];
	pathPrefix?: string;
	themes: QuestionnaireTheme[];
}) {
	return (
		<div className="space-y-4">
			{nodes.map((node, index) => (
				<NodeRenderer
					key={`${pathPrefix ?? "root"}:${getNodeKey(node, index)}`}
					arrayExclusiveScope={arrayExclusiveScope}
					form={form}
					node={node}
					pathPrefix={pathPrefix}
					themes={themes}
				/>
			))}
		</div>
	);
}

function GroupRenderer({
	arrayExclusiveScope,
	form,
	groupNode,
	pathPrefix,
	themes,
}: {
	arrayExclusiveScope?: ArrayExclusiveScope;
	form: UseFormReturn<ConfigurationFormValues>;
	groupNode: ConfigurationGroupNode;
	pathPrefix?: string;
	themes: QuestionnaireTheme[];
}) {
	return (
		<div className={gridClass(groupNode.cols)}>
			{groupNode.children.map((childNode, index) => (
				<NodeRenderer
					key={`${pathPrefix ?? "root"}:${getNodeKey(childNode, index)}`}
					arrayExclusiveScope={arrayExclusiveScope}
					form={form}
					node={childNode}
					pathPrefix={pathPrefix}
					themes={themes}
				/>
			))}
		</div>
	);
}

function buildFieldDefaultValue(fieldNode: ConfigurationFieldNode) {
	if (fieldNode.widget === "checkbox" || fieldNode.widget === "booleanSelect") {
		return false;
	}

	if (fieldNode.widget === "multiSelect") {
		return [];
	}

	if (fieldNode.widget === "keyValueTable") {
		return [];
	}

	return "";
}

function getNodeKey(node: ConfigurationNode, index: number) {
	if (node.kind === "field") {
		return `field:${node.id}:${node.path}`;
	}

	if (node.kind === "array") {
		return `array:${node.path}`;
	}

	return `group:${index}`;
}

function buildNodeInitialValues(
	node: ConfigurationNode,
): Record<string, unknown> {
	if (node.kind === "field") {
		return { [node.path]: buildFieldDefaultValue(node) };
	}

	if (node.kind === "array") {
		return { [node.path]: [] };
	}

	return Object.assign(
		{},
		...node.children.map((childNode) => buildNodeInitialValues(childNode)),
	);
}

function ArrayRenderer({
	arrayNode,
	form,
	themes,
}: {
	arrayNode: ConfigurationArrayNode;
	form: UseFormReturn<ConfigurationFormValues>;
	themes: QuestionnaireTheme[];
}) {
	const fieldArray = useFieldArray({
		control: form.control,
		name: arrayNode.path as never,
	});

	return (
		<div className="grid gap-3">
			{fieldArray.fields.length === 0 ? (
				<p className="text-sm text-text-secondary">{arrayNode.emptyText}</p>
			) : null}

			{fieldArray.fields.map((entry, index) => (
				<div
					key={entry.id}
					data-test-id={`configuration-form__${arrayNode.path}-row`}
					data-row-index={index}
					className="grid gap-3 rounded-md border border-border-primary bg-bg-primary p-4"
				>
					<NodeRenderer
						arrayExclusiveScope={{
							arrayPath: arrayNode.path,
							fieldIds: arrayNode.exclusiveTrueFieldIds ?? [],
							rowCount: fieldArray.fields.length,
							rowIndex: index,
						}}
						form={form}
						node={arrayNode.item}
						pathPrefix={`${arrayNode.path}.${index}`}
						themes={themes}
					/>
					<div className="flex justify-end">
						<Button
							danger
							size="small"
							type="button"
							variant="secondary"
							data-test-id={`configuration-form__${arrayNode.path}-remove-row-button`}
							onClick={() => fieldArray.remove(index)}
						>
							<Trash2 />
							Remove
						</Button>
					</div>
				</div>
			))}

			<Button
				className="justify-self-start"
				size="small"
				type="button"
				variant="secondary"
				data-test-id={`configuration-form__${arrayNode.path}-add-row-button`}
				onClick={() =>
					fieldArray.append(buildNodeInitialValues(arrayNode.item) as never)
				}
			>
				<Plus />
				{arrayNode.addLabel}
			</Button>
		</div>
	);
}

function NodeRenderer({
	arrayExclusiveScope,
	form,
	node,
	pathPrefix,
	themes,
}: {
	arrayExclusiveScope?: ArrayExclusiveScope;
	form: UseFormReturn<ConfigurationFormValues>;
	node: ConfigurationNode;
	pathPrefix?: string;
	themes: QuestionnaireTheme[];
}) {
	if (node.kind === "field") {
		const path = pathPrefix ? `${pathPrefix}.${node.path}` : node.path;
		return (
			<FieldRenderer
				arrayExclusiveScope={arrayExclusiveScope}
				fieldNode={node}
				form={form}
				path={path}
				themes={themes}
			/>
		);
	}

	if (node.kind === "array") {
		const path = pathPrefix ? `${pathPrefix}.${node.path}` : node.path;
		return (
			<ArrayRenderer
				arrayNode={{ ...node, path }}
				form={form}
				themes={themes}
			/>
		);
	}

	return (
		<GroupRenderer
			arrayExclusiveScope={arrayExclusiveScope}
			form={form}
			groupNode={node}
			pathPrefix={pathPrefix}
			themes={themes}
		/>
	);
}

function ConfigurationCategorySection({
	category,
	children,
	description,
}: {
	category: string[];
	children: ReactNode;
	description: string;
}) {
	const sectionId = buildSectionId(category);
	const title = category.length > 1 ? category.join(": ") : category[0];

	return (
		<section
			id={sectionId}
			data-test-id="configuration-form__section"
			data-section-title={title}
			className="flex flex-col scroll-mt-4 @[900px]:flex-row"
		>
			<div className="sticky top-0 z-10 h-fit w-full shrink-0 bg-bg-primary px-8 pt-2 shadow-[0_10px_10px_0_var(--color-bg-primary)] @[900px]:min-w-[346px] @[900px]:w-[346px]">
				<h2 className="text-lg font-semibold text-text-primary">{title}</h2>
				<p className="mt-1 text-sm text-text-secondary">{description}</p>
			</div>
			<div className="min-w-0 flex-1 pt-2 @[900px]:max-w-[644px] @[900px]:px-8">
				<div className="space-y-8">{children}</div>
			</div>
		</section>
	);
}

export function ConfigurationSectionsRenderer({
	form,
	sections,
	themes,
}: {
	form: UseFormReturn<ConfigurationFormValues>;
	sections: FilteredConfigurationSection[];
	themes: QuestionnaireTheme[];
}) {
	return (
		<div className="mt-6 space-y-10">
			{sections.map((section) => (
				<div key={categoryKey(section.category)} className="space-y-10">
					<div id={buildSectionId(section.category)} className="scroll-mt-4" />

					{section.subcategories.map((subcategory) => (
						<ConfigurationSubsectionRenderer
							key={categoryKey(subcategory.category)}
							form={form}
							subsection={subcategory}
							themes={themes}
						/>
					))}
				</div>
			))}
		</div>
	);
}

function ConfigurationSubsectionRenderer({
	form,
	subsection,
	themes,
}: {
	form: UseFormReturn<ConfigurationFormValues>;
	subsection: FilteredConfigurationSubsection;
	themes: QuestionnaireTheme[];
}) {
	return (
		<ConfigurationCategorySection
			category={subsection.category}
			description={subsection.description}
		>
			<NodesRenderer form={form} nodes={subsection.nodes} themes={themes} />
		</ConfigurationCategorySection>
	);
}
